"""Native-categorical boosting; target-free inputs and unchanged geographic evaluation."""
import json
import numpy as np
from catboost import CatBoostRegressor
from sklearn.model_selection import GroupKFold
from sklearn.metrics import mean_squared_error
from train_lithium_model import load_samples,spatial_blocks,scores,OUT,NUMERIC,CATEGORICAL

def features(df):
 original=df[NUMERIC+CATEGORICAL].copy()
 for c in CATEGORICAL:original[c]=original[c].astype(str)
 geology=original.copy()
 for name in ['hosston_alt','cottonvalley_alt','smackover_middepth']:geology[name]=df[name]
 geology['relative_depth']=df.DEPTH_FILL-df.smackover_middepth
 geology['normalized_depth']=geology.relative_depth/df.smackover_thick.clip(lower=1)
 location=geology.copy();location['latitude']=df.LATITUDE;location['longitude']=df.LONGITUDE
 return {'original':original,'geology':geology,'location':location}

def model(depth,l2):
 return CatBoostRegressor(iterations=600,depth=depth,l2_leaf_reg=l2,learning_rate=.03,boosting_type='Ordered',loss_function='RMSE',random_seed=42,thread_count=2,verbose=False,allow_writing_files=False,cat_features=CATEGORICAL)

def main():
 df=load_samples();y=df.Li.to_numpy(float);groups=spatial_blocks(df.LATITUDE.to_numpy(),df.LONGITUDE.to_numpy());xs=features(df);oof=np.zeros(len(y));folds=[]
 for i,(tr,te) in enumerate(GroupKFold(5).split(df,y,groups)):
  losses={};inner=list(GroupKFold(4).split(tr,y[tr],groups[tr]))
  for fs,X in xs.items():
   for depth in [3,5,7]:
    for l2 in [1,10]:
     pred=np.zeros(len(tr))
     for a,b in inner:pred[b]=model(depth,l2).fit(X.iloc[tr[a]],y[tr[a]]).predict(X.iloc[tr[b]])
     losses[f'{fs}/{depth}/{l2}']=float(mean_squared_error(y[tr],pred))
  selected=min(losses,key=losses.get);fs,depth,l2=selected.split('/')
  oof[te]=model(int(depth),int(l2)).fit(xs[fs].iloc[tr],y[tr]).predict(xs[fs].iloc[te])
  folds.append({'fold':i,'selected':selected,'inner_mse':losses,'scores':scores(y[te],oof[te])});print('Fold',i+1,folds[-1],flush=True)
 report={'protocol':'Same five outer geographic folds and 221 samples; four inner folds choose settings and feature set. Development benchmark, not independent validation.','scores':scores(y,oof),'predictions':oof.tolist(),'sample_ids':df.SITEID.tolist(),'folds':folds}
 (OUT/'catboost_benchmark.json').write_text(json.dumps(report,indent=2));print('FINAL',report['scores'],flush=True)
if __name__=='__main__':main()
