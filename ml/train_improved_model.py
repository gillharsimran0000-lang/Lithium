"""Publish the improved Extra Trees model with reproducible evaluation artifacts.

Run benchmark_extra_trees.py first. This is a development comparison on the
original five spatial folds, NOT an independent prospective validation.
The original model and artifacts are preserved in data/model_baseline/.
"""
import json
import shutil
import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.model_selection import GroupKFold, KFold
from sklearn.inspection import permutation_importance
from benchmark_models import candidates, choose
from train_lithium_model import load_samples, encode, spatial_blocks, scores, predict_grid, group_importance, OUT, ROOT, USGS, MODEL_DIR


def main():
    baseline=ROOT/'data/model_baseline';baseline.mkdir(exist_ok=True)
    for src in [OUT/'ml_metrics.json',OUT/'ml_grid.json',MODEL_DIR/'lithium_model.joblib']:
        if not (baseline/src.name).exists(): shutil.copy2(src,baseline/src.name)
    metrics=json.loads((baseline/'ml_metrics.json').read_text())
    report=json.loads((OUT/'extra_trees_benchmark.json').read_text())
    df=load_samples(); X=encode(df); y=df.Li.to_numpy(float)
    assert report['sample_ids']==df.SITEID.tolist()
    assert report['scores']['r2'] > metrics['results']['random_forest']['spatial_cv']['r2']
    groups=spatial_blocks(df.LATITUDE.to_numpy(),df.LONGITUDE.to_numpy())
    models={k:v for k,v in candidates().items() if k.startswith('extra_trees')}
    oof=np.asarray(report['predictions']); random_oof=np.zeros(len(y)); widths=np.zeros(len(y)); imps=[]
    for i,(tr,te) in enumerate(GroupKFold(5).split(X,y,groups)):
        name=report['folds'][i]['chosen']; m=clone(models[name]).fit(X.iloc[tr],y[tr])
        assert np.allclose(m.predict(X.iloc[te]),oof[te])
        imp=permutation_importance(m,X.iloc[te],y[te],scoring='neg_mean_absolute_error',n_repeats=10,random_state=42)
        imps.append(pd.Series(imp.importances_mean,index=X.columns))
        train_oof=np.zeros(len(tr))
        for a,b in GroupKFold(4).split(X.iloc[tr],y[tr],groups[tr]):
            train_oof[b]=clone(models[name]).fit(X.iloc[tr[a]],y[tr[a]]).predict(X.iloc[tr[b]])
        widths[te]=np.quantile(np.abs(y[tr]-train_oof),.9)
        print('Spatial fold verified',i+1,flush=True)
    for i,(tr,te) in enumerate(KFold(5,shuffle=True,random_state=42).split(X)):
        name,_=choose(X.iloc[tr],y[tr],np.arange(len(tr)),models)
        random_oof[te]=clone(models[name]).fit(X.iloc[tr],y[tr]).predict(X.iloc[te])
        print('Random fold',i+1,flush=True)
    usgs=pd.read_csv(USGS/'output/SAR_Lipreds.csv',dtype={'SITEID':str},encoding='utf-8-sig')
    role=df.SITEID.map(dict(zip(usgs.SITEID,usgs.mtype)));tr=(role=='train').to_numpy();te=(role=='holdout').to_numpy()
    hold_name,_=choose(X[tr],y[tr],groups[tr],models)
    hold=clone(models[hold_name]).fit(X[tr],y[tr]).predict(X[te])
    final_name,selection=choose(X,y,groups,models)
    final=clone(models[final_name]).fit(X,y)
    half=float(np.quantile(np.abs(y-oof),.9))
    metrics['chosen_model']='extra_trees'
    metrics['chosen_params']={k:v for k,v in final.get_params().items() if k in ('n_estimators','min_samples_leaf','max_features','max_depth')}
    metrics['results']['extra_trees']={'spatial_cv':scores(y,oof),'random_cv':scores(y,random_oof)}
    metrics['usgs_holdout']['this_model']=scores(y[te],hold)
    metrics['interval']={'target':.9,'half_width_mg_l':round(half,1),'spatial_cv_coverage':float(np.mean(np.abs(y-oof)<=half)), 'fold_validation_coverage':float(np.mean(np.abs(y-oof)<=widths)), 'note':'Final width calibrated on development out-of-fold residuals. Separate fold coverage tests widths estimated without the outer test outcomes; no guarantee for new regions.'}
    metrics['importance']=group_importance(pd.concat(imps,axis=1).mean(axis=1))
    metrics['observed_vs_predicted']=[{'id':sid,'lat':float(lat),'lon':float(lon),'observed':float(actual),'predicted':round(float(pred),1)} for sid,lat,lon,actual,pred in zip(df.SITEID,df.LATITUDE,df.LONGITUDE,y,oof)]
    metrics['development_note']='Extra Trees improved the original spatial cross-validation benchmark. Model families were compared using these development folds; a new independent geographic dataset is still needed to confirm generalization.'
    metrics['selection']={'name':final_name,'inner_mse':selection,'benchmark':'extra_trees_benchmark.json'}
    grid=predict_grid(final,X.columns,half)
    joblib.dump({'model':final,'columns':list(X.columns),'half_width':half,'family':'extra_trees'},MODEL_DIR/'lithium_model.joblib')
    (OUT/'ml_metrics.json').write_text(json.dumps(metrics,indent=1))
    (OUT/'ml_grid.json').write_text(json.dumps(grid,separators=(',',':')))
    print('PUBLISHED',metrics['results']['extra_trees'],'USGS split',metrics['usgs_holdout']['this_model'],'interval',metrics['interval'],flush=True)

if __name__=='__main__':main()
