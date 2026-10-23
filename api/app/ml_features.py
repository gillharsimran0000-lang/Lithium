"""Target-free feature construction shared by training and live prediction."""
import pandas as pd

NUMERIC = ['hosston_thickness', 'cottonvalley_thickness', 'buckner_thick', 'h2s_class',
           'smackover_alt', 'smackover_thick', 'smck_temp_int', 'DEPTH_FILL']
CATEGORICAL = ['buckner_facies', 'smackover_facies', 'FRM_GRP']


def make_features(df, columns=None, expanded=False):
    X = pd.get_dummies(df[NUMERIC + CATEGORICAL].astype({c: str for c in CATEGORICAL}),
                       columns=CATEGORICAL, dtype=float)
    if expanded:
        for name in ['hosston_alt', 'cottonvalley_alt', 'smackover_middepth']:
            X[name] = df[name]
        X['depth_from_smackover_midpoint'] = df.DEPTH_FILL - df.smackover_middepth
        X['depth_relative_to_thickness'] = X.depth_from_smackover_midpoint / df.smackover_thick.clip(lower=1)
        X['temperature_per_depth'] = df.smck_temp_int / df.smackover_middepth.clip(lower=1) * 1000
        X['latitude'] = df.LATITUDE
        X['longitude'] = df.LONGITUDE
    if columns is not None:
        X = X.reindex(columns=columns, fill_value=0.)
    return X
