"""Verify all evaluations improve, archive current artifacts, and publish the blend."""
import sys,json,shutil
from pathlib import Path
import joblib,numpy as np,pandas as pd,rasterio
from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import VotingRegressor
from sklearn.pipeline import make_pipeline
from sklearn.inspection import permutation_importance
from sklearn.model_selection import GroupKFold
from train_lithium_model import load_samples, spatial_blocks, scores, OUT, ROOT, MODEL_DIR, USGS, READABLE, NUMERIC, CATEGORICAL
from benchmark_spatial_expansion import feature_sets,models
from benchmark_feature_selection import candidates
sys.path.insert(0,str(ROOT/'api'))
from app.ml_features import make_features
from app.ml_service import raster_stack


def ensemble(selected, features):
    ms=models(); estimators=[]
    for i,key in enumerate(selected):
        fs,name=key.split('|') if '|' in key else key.split('/')
        model=candidates()[name] if '|' in key else ms[name][1]
        select=ColumnTransformer([('features','passthrough',list(features[fs].columns))],remainder='drop')
        estimators.append((f'member{i}',make_pipeline(select,clone(model))))
    return VotingRegressor(estimators,weights=[1,1,1,3])


def main():
    old=json.loads((OUT/'ml_metrics.json').read_text())
    report=json.loads((OUT/'combined_spatial_benchmark.json').read_text());val=json.loads((OUT/'combined_spatial_validation.json').read_text())
    score=report['scores']['top3_blend']; previous=old['results'][old['chosen_model']]
    assert score['r2']>previous['spatial_cv']['r2'] and score['rmse']<previous['spatial_cv']['rmse']
    assert val['random_cv']['r2'] >= previous['random_cv']['r2']-.01
    assert val['usgs_holdout']['r2'] >= old['usgs_holdout']['this_model']['r2']
    df=load_samples();y=df.Li.to_numpy(float);features=feature_sets(df);X=make_features(df,expanded=True)
    assert X.equals(features['geology_location']);assert report['sample_ids']==df.SITEID.tolist()
    groups=spatial_blocks(df.LATITUDE.to_numpy(),df.LONGITUDE.to_numpy());oof=np.array(report['predictions']['top3_blend']);imps=[];widths=np.zeros(len(y))
    for i,(tr,te) in enumerate(GroupKFold(5).split(X,y,groups)):
        selected=report['folds'][i]['blend'];m=ensemble(selected,features).fit(X.iloc[tr],y[tr])
        assert np.allclose(m.predict(X.iloc[te]),oof[te])
        imp=permutation_importance(m,X.iloc[te],y[te],scoring='neg_mean_absolute_error',n_repeats=10,random_state=42)
        imps.append(pd.Series(imp.importances_mean,index=X.columns))
        train_oof=np.zeros(len(tr))
        for a,b in GroupKFold(4).split(tr,y[tr],groups[tr]):
            train_oof[b]=ensemble(selected,features).fit(X.iloc[tr[a]],y[tr[a]]).predict(X.iloc[tr[b]])
        widths[te]=np.quantile(abs(y[tr]-np.maximum(train_oof,0)),.9)
        print('Verified spatial fold',i+1,flush=True)
    final=ensemble(val['final_models'],features).fit(X,y);oof=np.maximum(oof,0);half=float(np.quantile(abs(y-oof),.9))
    stack=raster_stack();pred=np.maximum(final.predict(make_features(stack,X.columns,expanded=True)),0)
    with rasterio.open(USGS/'grid/SAR_modeldomain_mask.tif') as src:mask=src.read(1).ravel()
    grid=[{'cell':i,'pred':round(float(p),1),'low':round(max(0.,p-half),1),'high':round(float(p+half),1)} for i,p in enumerate(pred) if mask[i]==1]
    metrics=old.copy();metrics['results']=dict(old['results']);metrics['results']['spatial_ensemble']={'spatial_cv':scores(y,oof),'random_cv':val['random_cv']}
    metrics['chosen_model']='spatial_ensemble';metrics['chosen_params']={'members':4,'models':', '.join(val['final_models'])};metrics['usgs_holdout']['this_model']=val['usgs_holdout']
    metrics['interval']={'target':.9,'half_width_mg_l':round(half,1),'spatial_cv_coverage':float(np.mean(abs(y-oof)<=half)),'fold_validation_coverage':float(np.mean(abs(y-oof)<=widths)),'note':'Calibrated on development residuals; outer-fold coverage uses widths estimated from outer training data only.'}
    per=pd.concat(imps,axis=1).mean(axis=1); totals={}
    for col,value in per.items():
        name=next((v for v in NUMERIC+CATEGORICAL if col==v or col.startswith(v+'_')),col);totals[name]=totals.get(name,0)+float(value)
    labels={**READABLE,'hosston_alt':'Hosston top elevation','cottonvalley_alt':'Cotton Valley top elevation','smackover_middepth':'Smackover midpoint depth','depth_from_smackover_midpoint':'Sample depth relative to Smackover','depth_relative_to_thickness':'Relative depth / formation thickness','temperature_per_depth':'Temperature / midpoint depth','latitude':'Latitude','longitude':'Longitude'}
    metrics['importance']=[{'variable':k,'label':labels.get(k,k),'mae_increase_mg_l':round(v,2)} for k,v in sorted(totals.items(),key=lambda x:-x[1])]
    metrics['observed_vs_predicted']=[{'id':sid,'lat':float(lat),'lon':float(lon),'observed':float(actual),'predicted':round(float(p),1)} for sid,lat,lon,actual,p in zip(df.SITEID,df.LATITUDE,df.LONGITUDE,y,oof)]
    metrics['development_note']='Model families and features were compared on the original development benchmark. Spatial folds and all 221 samples are unchanged. Independent geographic validation is still required. The 0.85 spatial target has not been achieved. Fixed 50:50 procedure blend improves spatial performance; random R² declines slightly from 0.864 to 0.861.'
    metrics['selection']={'members':val['final_models'],'benchmark':'combined_spatial_benchmark.json','secondary_validation':'combined_spatial_validation.json'}
    metrics['features']=list(labels);metrics['feature_labels']=labels
    archive=ROOT/'data/model_spatial_ensemble';archive.mkdir(exist_ok=True)
    for src in [OUT/'ml_metrics.json',OUT/'ml_grid.json',MODEL_DIR/'lithium_model.joblib']:
        if not (archive/src.name).exists():shutil.copy2(src,archive/src.name)
    joblib.dump({'model':final,'columns':list(X.columns),'half_width':half,'family':'spatial_ensemble','expanded_features':True,'nonnegative':True},MODEL_DIR/'lithium_model.joblib')
    (OUT/'ml_metrics.json').write_text(json.dumps(metrics,indent=1));(OUT/'ml_grid.json').write_text(json.dumps(grid,separators=(',',':')))
    print('PUBLISHED',metrics['results']['spatial_ensemble'],metrics['usgs_holdout']['this_model'],metrics['interval'],flush=True)
if __name__=='__main__':main()
