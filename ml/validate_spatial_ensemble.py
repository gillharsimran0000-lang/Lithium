"""Validate the spatial-search blend on secondary splits before any deployment."""
import json
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.model_selection import GroupKFold,KFold
from sklearn.metrics import mean_squared_error
from benchmark_spatial_expansion import feature_sets,models
from train_lithium_model import load_samples,spatial_blocks,scores,OUT,USGS

def select_blend(df,y,groups):
 xs=feature_sets(df); ms=models();losses={}; inner=list(GroupKFold(4).split(df,y,groups))
 for fs,X in xs.items():
  for name,(_,m) in ms.items():
   pred=np.zeros(len(y))
   for tr,te in inner:pred[te]=clone(m).fit(X.iloc[tr],y[tr]).predict(X.iloc[te])
   losses[f'{fs}/{name}']=float(mean_squared_error(y,pred))
 return sorted(losses,key=losses.get)[:3],losses

def predict(train,y,test,selected):
 tx=feature_sets(train);vx=feature_sets(test);ms=models();pred=[]
 for key in selected:
  fs,name=key.split('/');pred.append(clone(ms[name][1]).fit(tx[fs],y).predict(vx[fs].reindex(columns=tx[fs].columns,fill_value=0)))
 return np.mean(pred,axis=0)

def main():
 df=load_samples();y=df.Li.to_numpy(float);groups=spatial_blocks(df.LATITUDE.to_numpy(),df.LONGITUDE.to_numpy());random_oof=np.zeros(len(y));folds=[]
 for i,(tr,te) in enumerate(KFold(5,shuffle=True,random_state=42).split(df)):
  selected,_=select_blend(df.iloc[tr],y[tr],np.arange(len(tr)))
  random_oof[te]=predict(df.iloc[tr],y[tr],df.iloc[te],selected)
  folds.append({'fold':i,'models':selected});print('Random fold',i+1,selected,flush=True)
 usgs=pd.read_csv(USGS/'output/SAR_Lipreds.csv',dtype={'SITEID':str},encoding='utf-8-sig');role=df.SITEID.map(dict(zip(usgs.SITEID,usgs.mtype)));tr=(role=='train').to_numpy();te=(role=='holdout').to_numpy()
 selected,_=select_blend(df[tr],y[tr],groups[tr]);hold=predict(df[tr],y[tr],df[te],selected)
 final,losses=select_blend(df,y,groups)
 report={'random_cv':scores(y,random_oof),'usgs_holdout':scores(y[te],hold),'holdout_models':selected,'final_models':final,'full_inner_mse':losses,'random_folds':folds,'random_predictions':random_oof.tolist(),'holdout_predictions':hold.tolist()}
 (OUT/'spatial_ensemble_validation.json').write_text(json.dumps(report,indent=2));print('FINAL',report['random_cv'],report['usgs_holdout'],final,flush=True)
if __name__=='__main__':main()
