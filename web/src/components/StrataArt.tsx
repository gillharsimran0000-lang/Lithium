"use client";

// A drawn cross-section of the rock under southern Arkansas (not to scale). Layer order follows
// Knierim and others (2024, Science Advances); depths are medians at the 221 USGS sample sites. The Smackover layer,
// where the lithium-rich brine is, glows. Step 0 shows the layers, step 1 adds a well reaching the
// brine, and steps 2–3 show lithium rising up the well to a surface plant. Important parts stay
// near the middle so they survive cropping in both wide and narrow panels.
const LAYERS = [
  { name: "Younger layers", top: "M0 150 C180 142 400 160 600 146", fill: "#14231f", pattern: "silt", label: 192 },
  { name: "Hosston Formation · sandstone", depth: "top about 1.4 km down", top: "M0 252 C170 244 390 262 600 248", fill: "#13241f", pattern: "sand", label: 290 },
  { name: "Cotton Valley Group · sandstone, shale", depth: "top about 1.7 km down", top: "M0 352 C170 342 380 366 600 348", fill: "#122522", pattern: "sand", label: 392 },
  { name: "Buckner Member · anhydrite", top: "M0 490 C190 482 400 500 600 486", fill: "#172320", pattern: "hatch", label: 530 },
  { name: "Smackover · limestone, lithium brine", depth: "top about 2.4 km down", top: "M0 580 C180 572 390 592 600 576", fill: "#123a31", pattern: "ooids", label: 622, brine: true },
  { name: "Norphlet sandstone / Louann Salt", top: "M0 760 C210 752 400 770 600 756", fill: "#101b19", pattern: "hatch", label: 804 },
];

// Fixed positions so the art looks the same on the server and in the browser.
const LITHIUM = [[118, 650], [160, 700], [196, 636], [232, 724], [268, 668], [300, 738], [352, 646], [388, 706], [424, 660], [462, 724], [140, 742], [214, 684], [326, 694], [410, 632], [496, 676], [176, 620], [286, 626], [448, 744], [520, 640], [530, 716]];
const PINES = [96, 128, 152, 196, 236, 268, 384, 420, 452, 492, 528, 560];
export function StrataArt({ step }: { step: number }) {
  return (
    <div className="strata-art">
      <svg viewBox="0 0 600 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0f1d1b" /><stop offset="1" stopColor="#1d3a31" /></linearGradient>
          <radialGradient id="brine-glow" cx=".5" cy=".5" r=".6"><stop offset="0" stopColor="#99d9b1" stopOpacity=".3" /><stop offset="1" stopColor="#99d9b1" stopOpacity="0" /></radialGradient>
          <pattern id="silt" width="40" height="12" patternUnits="userSpaceOnUse"><path d="M0 6 H22" stroke="rgba(255,255,255,.05)" /></pattern>
          <pattern id="sand" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="4" cy="5" r="1" fill="rgba(255,255,255,.07)" /><circle cx="12" cy="12" r=".8" fill="rgba(255,255,255,.06)" /></pattern>
          <pattern id="hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0 V14" stroke="rgba(255,255,255,.05)" /></pattern>
          <pattern id="ooids" width="15" height="15" patternUnits="userSpaceOnUse"><circle cx="7.5" cy="7.5" r="3.4" fill="none" stroke="rgba(153,217,177,.16)" /></pattern>
        </defs>
        <rect width="600" height="900" fill="url(#sky)" />
        {PINES.map((x) => <path key={x} d={`M${x} 150 l9 -26 l9 26 Z`} className="pine" />)}
        {LAYERS.map((layer) => (
          <g key={layer.name} className={layer.brine ? "strata-brine" : undefined}>
            <path d={`${layer.top} V900 H0 Z`} fill={layer.fill} />
            <path d={`${layer.top} V900 H0 Z`} fill={`url(#${layer.pattern})`} />
            <path d={layer.top} className="strata-line" />
          </g>
        ))}
        <ellipse cx="320" cy="670" rx="300" ry="130" fill="url(#brine-glow)" className="brine-glow" />
        {LITHIUM.map(([x, y], i) => <circle key={i} cx={x} cy={662 + (y - 620) * 0.72} r="3.4" className="li-ion" style={{ animationDelay: `${(i % 6) * -0.7}s` }} />)}
        {LAYERS.map((layer) => (
          <text key={layer.name} x="132" y={layer.label} className={layer.brine ? "strata-label is-brine" : "strata-label"}>
            {layer.name}
            {layer.depth && <tspan x="132" dy="19" className="strata-depth">{layer.depth}</tspan>}
          </text>
        ))}
        {step >= 1 && (
          <g className="well">
            <rect x="436" y="124" width="28" height="26" rx="3" className="well-head" />
            <path d="M450 150 V680" className="well-line" />
            {step === 1 && <circle cx="450" cy="680" r="10" className="well-sample" />}
          </g>
        )}
        {step >= 2 && (
          <g>
            <rect x="342" y="108" width="84" height="42" rx="5" className="plant" />
            <text x="384" y="134" className="plant-label">DLE plant</text>
            {[0, 1, 2, 3].map((i) => <circle key={i} cx="450" cy="680" r="4.5" className="li-rising" style={{ animationDelay: `${i * 0.6}s` }} />)}
          </g>
        )}
        <text x="466" y="104" className="strata-note">Not to scale</text>
      </svg>
    </div>
  );
}
