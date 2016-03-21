uniform vec4 u_revealColor;

// the Y coordinate in model space from where the fragments are revealed
uniform float u_revealStart;
// whether the front part (larger Y coordinates) of model is the one revealed
uniform bool u_revealFront;
// a gradient transition from white color will be added for this length after u_revealStart
uniform float u_revealTransitionLength;

// the coordinates of this fragment in model space
varying vec4 v_modelPos;