"""Evaluate a fixed 50:50 blend; weights are not tuned on outer test labels."""
import json
import numpy as np
import pandas as pd
from train_lithium_model import load_samples,scores,OUT,USGS

def main():
    df=load_samples();a=json.loads((OUT/'spatial_expansion_benchmark.json').read_text());b=json.loads((OUT/'feature_selection_benchmark.json').read_text());av=json.loads((OUT/'spatial_ensemble_validation.json').read_text());bv=json.loads((OUT/'feature_selection_validation.json').read_text())
    assert a['sample_ids']==b['sample_ids']==df.SITEID.tolist()
    for fa,fb in zip(a['folds'],b['folds']):
        assert fa['test_ids']==fb['test_ids'];fa['blend']+=fb['selected'][:1]
    p=(np.array(a['predictions']['top3_blend'])+np.array(b['predictions']['selected']))/2
    a['predictions']['top3_blend']=p.tolist();a['scores']['top3_blend']=scores(df.Li,p)
    a['protocol']='Fixed 50:50 combination of independently inner-selected procedures. Same geographic folds. Reused development benchmark; weights not tuned on outer outcomes.'
    for key in ['random_predictions','holdout_predictions']:
        av[key]=((np.array(av[key])+np.array(bv[key]))/2).tolist()
    usgs=pd.read_csv(USGS/'output/SAR_Lipreds.csv',dtype={'SITEID':str},encoding='utf-8-sig');role=df.SITEID.map(dict(zip(usgs.SITEID,usgs.mtype)))
    av['random_cv']=scores(df.Li,av['random_predictions']);av['usgs_holdout']=scores(df.loc[role=='holdout','Li'],av['holdout_predictions']);av['final_models']+=bv['final_models'];av['holdout_models']+=bv['holdout_models']
    (OUT/'combined_spatial_benchmark.json').write_text(json.dumps(a,indent=2));(OUT/'combined_spatial_validation.json').write_text(json.dumps(av,indent=2))
    print(a['scores']['top3_blend'],av['random_cv'],av['usgs_holdout'])
if __name__=='__main__':main()
