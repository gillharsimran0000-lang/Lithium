"""Training-only feature selection and smooth nonlinear regression on fixed spatial folds."""
import json
import argparse
import numpy as np
from sklearn.base import clone
from sklearn.feature_selection import SelectKBest, f_regression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler, RobustScaler, SplineTransformer, PolynomialFeatures
from sklearn.linear_model import Ridge
from sklearn.svm import SVR
from sklearn.model_selection import GroupKFold
from sklearn.metrics import mean_squared_error
from benchmark_spatial_expansion import feature_sets
from train_lithium_model import load_samples,spatial_blocks,scores,OUT

def candidates():
    result={}
    for k in [5,10,'all']:
        for c in [50,200,1000]:
            for gamma in [.005,.02,.08,.3]:
                for scale in ['standard','robust']:
                    scaler=StandardScaler() if scale=='standard' else RobustScaler()
                    result[f'svr/{k}/{c}/{gamma}/{scale}']=make_pipeline(scaler,SelectKBest(f_regression,k=k),SVR(C=c,gamma=gamma,epsilon=10))
    for degree in [1,2]:
        for alpha in [1,10,100,1000]:
            result[f'polynomial/{degree}/{alpha}']=make_pipeline(StandardScaler(),PolynomialFeatures(degree,include_bias=False),Ridge(alpha=alpha))
    for knots in [3,5,8]:
        for alpha in [1,10,100]:
            result[f'splines/{knots}/{alpha}']=make_pipeline(StandardScaler(),SplineTransformer(n_knots=knots),Ridge(alpha=alpha))
    return result

def main():
    parser=argparse.ArgumentParser();parser.add_argument("--neural",action="store_true");args=parser.parse_args()
    df=load_samples(); y=df.Li.to_numpy(float);g=spatial_blocks(df.LATITUDE.to_numpy(),df.LONGITUDE.to_numpy());xs=feature_sets(df);ms=candidates()
    if args.neural:
        from sklearn.neural_network import MLPRegressor
        from sklearn.compose import TransformedTargetRegressor
        from sklearn.ensemble import HistGradientBoostingRegressor
        ms={}
        for width in [(16,), (32,), (16,8)]:
            for alpha in [.1, 1., 10.]:
                for activation in ["tanh", "relu"]:
                    ms[f"mlp/{width}/{alpha}/{activation}"]=make_pipeline(StandardScaler(),TransformedTargetRegressor(regressor=MLPRegressor(hidden_layer_sizes=width,alpha=alpha,activation=activation,solver="lbfgs",max_iter=600,random_state=42),transformer=StandardScaler()))
        for leaves in [4,8,16]:
            for regularization in [1,10,100]:
                ms[f"hist/{leaves}/{regularization}"]=HistGradientBoostingRegressor(max_iter=200,max_leaf_nodes=leaves,min_samples_leaf=8,l2_regularization=regularization,learning_rate=.05,random_state=42)
    predictions={k:np.zeros(len(y)) for k in ['selected','top5']};folds=[]
    for fold,(tr,te) in enumerate(GroupKFold(5).split(df,y,g)):
        loss={}
        for fs,X in xs.items():
            for name,m in ms.items():
                p=np.zeros(len(tr))
                for a,b in GroupKFold(4).split(tr,y[tr],g[tr]):
                    p[b]=clone(m).fit(X.iloc[tr[a]],y[tr[a]]).predict(X.iloc[tr[b]])
                loss[fs+'|'+name]=float(mean_squared_error(y[tr],np.maximum(p,0)))
        ranked=sorted(loss,key=loss.get);p=[]
        for key in ranked[:5]:
            fs,name=key.split('|');p.append(np.maximum(clone(ms[name]).fit(xs[fs].iloc[tr],y[tr]).predict(xs[fs].iloc[te]),0))
        predictions['selected'][te]=p[0];predictions['top5'][te]=np.mean(p,axis=0)
        folds.append({'fold':fold,'test_ids':df.SITEID.iloc[te].tolist(),'selected':ranked[:5],'inner_mse':loss})
        print('FOLD',fold+1,{k:scores(y[te],v[te]) for k,v in predictions.items()},ranked[:5],flush=True)
    report={'protocol':'Same 221 samples and five outer geographic folds. Feature selection, scaling and tuning use training folds only. Reused development benchmark.','sample_ids':df.SITEID.tolist(),'folds':folds,'scores':{k:scores(y,v) for k,v in predictions.items()},'predictions':{k:v.tolist() for k,v in predictions.items()}}
    (OUT/('neural_benchmark.json' if args.neural else 'feature_selection_benchmark.json')).write_text(json.dumps(report,indent=2));print('FINAL',report['scores'],flush=True)
if __name__=='__main__':main()
