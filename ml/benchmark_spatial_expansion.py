"""Fixed-fold development experiments: additional geology, location, kernels and ensembles.
No filtering of hard samples, no target-derived features, and no changed test folds.
Feature sets and settings are selected only with four inner geographic folds.
"""
import json
import hashlib
import numpy as np
from sklearn.base import clone
from sklearn.ensemble import ExtraTreesRegressor, GradientBoostingRegressor, HistGradientBoostingRegressor
from sklearn.compose import TransformedTargetRegressor
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.kernel_ridge import KernelRidge
from sklearn.svm import SVR
from sklearn.metrics import mean_squared_error
from sklearn.model_selection import GroupKFold
from train_lithium_model import load_samples, encode, spatial_blocks, scores, OUT


def feature_sets(df):
    base=encode(df)
    geology=base.copy()
    for name in ['hosston_alt','cottonvalley_alt','smackover_middepth']:
        geology[name]=df[name]
    geology['depth_from_smackover_midpoint']=df.DEPTH_FILL-df.smackover_middepth
    geology['depth_relative_to_thickness']=(df.DEPTH_FILL-df.smackover_middepth)/df.smackover_thick.clip(lower=1)
    geology['temperature_per_depth']=df.smck_temp_int/df.smackover_middepth.clip(lower=1)*1000
    location=geology.copy()
    location['latitude']=df.LATITUDE
    location['longitude']=df.LONGITUDE
    return {'original':base,'geology':geology,'geology_location':location}


def models():
    result={}
    for mf in [.33,.6,1.]:
        for leaf in [1,2,4]:
            result[f'et_{mf}_{leaf}']=('extra_trees',ExtraTreesRegressor(n_estimators=250,max_features=mf,min_samples_leaf=leaf,random_state=42,n_jobs=-1))
    for depth in [2,3,4]:
        for loss in ['squared_error','huber']:
            result[f'gb_{depth}_{loss}']=('gradient_boosting',GradientBoostingRegressor(n_estimators=300,learning_rate=.03,max_depth=depth,min_samples_leaf=4,loss=loss,random_state=42))
    for c in [100,500,2000]:
        for gamma in [.01,.05,.15]:
            result[f'svr_{c}_{gamma}']=('svr',make_pipeline(StandardScaler(),SVR(C=c,gamma=gamma,epsilon=5)))
    for alpha in [.01,.1,1,10]:
        for gamma in [.01,.05,.15]:
            result[f'krr_{alpha}_{gamma}']=('kernel_ridge',make_pipeline(StandardScaler(),KernelRidge(alpha=alpha,kernel='rbf',gamma=gamma)))
    result['et_log']=('extra_trees',TransformedTargetRegressor(regressor=ExtraTreesRegressor(n_estimators=250,min_samples_leaf=1,max_features=.6,random_state=42,n_jobs=-1),func=np.log1p,inverse_func=np.expm1))
    return result


def main():
    df=load_samples();y=df.Li.to_numpy(float); features=feature_sets(df); groups=spatial_blocks(df.LATITUDE.to_numpy(),df.LONGITUDE.to_numpy()); ms=models()
    families=sorted({v[0] for v in ms.values()})+['all_families','top3_blend']
    oof={f:np.zeros(len(y)) for f in families}; folds=[]
    splits=list(GroupKFold(5).split(df,y,groups))
    for i,(tr,te) in enumerate(splits):
        inner=list(GroupKFold(4).split(tr,y[tr],groups[tr])); losses={}; by_family={f:[] for f in families}
        for feature_name,X in features.items():
            for name,(family,model) in ms.items():
                inner_pred=np.zeros(len(tr))
                for a,b in inner:
                    inner_pred[b]=clone(model).fit(X.iloc[tr[a]],y[tr[a]]).predict(X.iloc[tr[b]])
                key=f'{feature_name}/{name}';losses[key]=float(mean_squared_error(y[tr],inner_pred));by_family[family].append(key)
        ranked=sorted(losses,key=losses.get); chosen={f:min(by_family[f],key=losses.get) for f in families if by_family[f]}; chosen['all_families']=ranked[0]
        prediction_cache={}
        for key in set(chosen.values())|set(ranked[:3]):
            fs,name=key.split('/');prediction_cache[key]=clone(ms[name][1]).fit(features[fs].iloc[tr],y[tr]).predict(features[fs].iloc[te])
        for family,key in chosen.items():oof[family][te]=prediction_cache[key]
        oof['top3_blend'][te]=np.mean([prediction_cache[k] for k in ranked[:3]],axis=0)
        folds.append({'fold':i,'test_ids':df.SITEID.iloc[te].tolist(),'chosen':chosen,'blend':ranked[:3],'inner_mse':losses,'scores':{f:scores(y[te],p[te]) for f,p in oof.items()}})
        print('FOLD',i+1,folds[-1]['scores'],flush=True)
        report={'protocol':'Unchanged five outer spatial folds; four inner spatial folds select feature set and settings. Reused development benchmark, not independent validation.','n_samples':len(y),'folds':folds,'scores':{f:scores(y,p) for f,p in oof.items()} if i==4 else None,'predictions':{f:p.tolist() for f,p in oof.items()} if i==4 else None,'sample_ids':df.SITEID.tolist(),'sample_id_sha256':hashlib.sha256('\n'.join(df.SITEID).encode()).hexdigest()}
        (OUT/'spatial_expansion_benchmark.json').write_text(json.dumps(report,indent=2))
    print('FINAL',report['scores'],flush=True)

if __name__=='__main__':main()
