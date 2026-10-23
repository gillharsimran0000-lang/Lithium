"""Reproducible nested spatial model search; never modifies the production model.
Same samples and five outer geographic folds as the original benchmark.
Candidates and all hyperparameter selection stay inside each outer training fold.
"""
import json
from pathlib import Path
import numpy as np
from sklearn.base import clone
from sklearn.ensemble import ExtraTreesRegressor, RandomForestRegressor, HistGradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVR
from sklearn.kernel_ridge import KernelRidge
from sklearn.model_selection import GroupKFold
from sklearn.metrics import mean_squared_error
from train_lithium_model import load_samples, encode, spatial_blocks, scores, OUT


def candidates():
    result = {}
    for leaf in [1, 2, 4]:
        for mf in [0.6, 1.0]:
            result[f'extra_trees_leaf{leaf}_features{mf}'] = ExtraTreesRegressor(n_estimators=350, min_samples_leaf=leaf, max_features=mf, random_state=42, n_jobs=-1)
    for leaf in [1, 2, 5]:
        result[f'random_forest_leaf{leaf}'] = RandomForestRegressor(n_estimators=350, min_samples_leaf=leaf, max_features=0.6, random_state=42, n_jobs=-1)
    for depth in [2, 3, 5]:
        result[f'boosting_depth{depth}'] = HistGradientBoostingRegressor(max_iter=250, max_depth=depth, learning_rate=.04, min_samples_leaf=8, l2_regularization=5, random_state=42)
    for c in [100, 300, 1000]:
        result[f'svr_C{c}'] = make_pipeline(SimpleImputer(), StandardScaler(), SVR(C=c, gamma='scale', epsilon=10))
    for alpha in [0.1, 1, 10]:
        result[f'kernel_ridge_alpha{alpha}'] = make_pipeline(SimpleImputer(), StandardScaler(), KernelRidge(alpha=alpha, kernel='rbf', gamma=.03))
    return result


def choose(X,y,groups,models):
    splits=list(GroupKFold(4).split(X,y,groups)); losses={}
    for name, model in models.items():
        pred=np.zeros(len(y))
        for tr,te in splits:
            pred[te]=clone(model).fit(X.iloc[tr],y[tr]).predict(X.iloc[te])
        losses[name]=float(mean_squared_error(y,pred))
    name=min(losses,key=losses.get)
    return name, losses


def main():
    df=load_samples();X=encode(df);y=df.Li.to_numpy(float)
    groups=spatial_blocks(df.LATITUDE.to_numpy(),df.LONGITUDE.to_numpy())
    models=candidates();oof=np.zeros(len(y));folds=[]
    for fold,(tr,te) in enumerate(GroupKFold(5).split(X,y,groups)):
        name,losses=choose(X.iloc[tr],y[tr],groups[tr],models)
        m=clone(models[name]).fit(X.iloc[tr],y[tr]);oof[te]=m.predict(X.iloc[te])
        folds.append({'fold':fold,'chosen':name,'n_test':len(te),'scores':scores(y[te],oof[te]),'inner_mse':losses})
        print(f'Fold {fold+1}: {name} {folds[-1]["scores"]}',flush=True)
    report={'evaluation':'Same five geographic outer folds; four inner geographic folds choose model and settings by MSE.', 'scores':scores(y,oof),'folds':folds,'predictions':oof.tolist(),'sample_ids':df.SITEID.tolist()}
    (OUT/'candidate_benchmark.json').write_text(json.dumps(report,indent=2))
    print('NESTED SPATIAL RESULT',report['scores'],flush=True)

if __name__=='__main__':main()
