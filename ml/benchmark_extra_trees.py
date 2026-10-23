"""Evaluate an Extra Trees family on the unchanged nested spatial folds."""
import json
import numpy as np
from sklearn.base import clone
from sklearn.model_selection import GroupKFold
from benchmark_models import candidates, choose
from train_lithium_model import load_samples, encode, spatial_blocks, scores, OUT

df=load_samples(); X=encode(df); y=df.Li.to_numpy(float)
groups=spatial_blocks(df.LATITUDE.to_numpy(),df.LONGITUDE.to_numpy())
models={k:v for k,v in candidates().items() if k.startswith('extra_trees')}
oof=np.zeros(len(y));folds=[]
for fold,(tr,te) in enumerate(GroupKFold(5).split(X,y,groups)):
 name,losses=choose(X.iloc[tr],y[tr],groups[tr],models)
 oof[te]=clone(models[name]).fit(X.iloc[tr],y[tr]).predict(X.iloc[te])
 folds.append({'fold':fold,'chosen':name,'scores':scores(y[te],oof[te]),'inner_mse':losses})
 print(folds[-1],flush=True)
report={'evaluation':'Extra Trees family, same 5 outer geographic folds, 4 inner folds select settings by MSE. Development benchmark; not a new independent test.', 'scores':scores(y,oof),'folds':folds,'predictions':oof.tolist(),'sample_ids':df.SITEID.tolist()}
(OUT/'extra_trees_benchmark.json').write_text(json.dumps(report,indent=2));print(report['scores'],flush=True)
