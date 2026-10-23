"""Spatial Gaussian-process development benchmark on the unchanged 221 samples."""
import json,warnings
import numpy as np
from sklearn.base import clone
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import ConstantKernel, Matern, RBF, WhiteKernel
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import GroupKFold
from sklearn.metrics import mean_squared_error
from sklearn.exceptions import ConvergenceWarning
from benchmark_spatial_expansion import feature_sets
from train_lithium_model import load_samples,spatial_blocks,scores,OUT
warnings.filterwarnings('ignore',category=ConvergenceWarning)

def main():
 df=load_samples();y=df.Li.to_numpy(float);groups=spatial_blocks(df.LATITUDE.to_numpy(),df.LONGITUDE.to_numpy());xs=feature_sets(df)
 candidates={}
 for fs in ['original','geology']:
  n=xs[fs].shape[1]
  for kind in ['matern','rbf']:
   for ard in [False,True]:
    length=np.ones(n) if ard else 1.
    k=Matern(length,(.1,100),nu=1.5) if kind=='matern' else RBF(length,(.1,100))
    kernel=ConstantKernel(1.,(.01,100))*k+WhiteKernel(.1,(.005,1.))
    candidates[f'{fs}/{kind}/{ard}']=(fs,make_pipeline(StandardScaler(),GaussianProcessRegressor(kernel=kernel,normalize_y=True,random_state=42,n_restarts_optimizer=0)))
 oof=np.zeros(len(y));folds=[]
 for fold,(tr,te) in enumerate(GroupKFold(5).split(df,y,groups)):
  losses={}
  for name,(fs,m) in candidates.items():
   p=np.zeros(len(tr))
   for a,b in GroupKFold(4).split(tr,y[tr],groups[tr]):
    p[b]=clone(m).fit(xs[fs].iloc[tr[a]],y[tr[a]]).predict(xs[fs].iloc[tr[b]])
   losses[name]=float(mean_squared_error(y[tr],p))
  selected=min(losses,key=losses.get);fs,m=candidates[selected]
  oof[te]=clone(m).fit(xs[fs].iloc[tr],y[tr]).predict(xs[fs].iloc[te])
  folds.append({'fold':fold,'selected':selected,'inner_mse':losses,'scores':scores(y[te],oof[te])})
  print('Fold',fold+1,folds[-1],flush=True)
 report={'protocol':'Same geographic folds and samples; four inner geographic folds choose kernel and feature set. Development benchmark.','scores':scores(y,oof),'predictions':oof.tolist(),'sample_ids':df.SITEID.tolist(),'folds':folds}
 (OUT/'gaussian_process_benchmark.json').write_text(json.dumps(report,indent=2));print('FINAL',report['scores'],flush=True)
if __name__=='__main__':main()
