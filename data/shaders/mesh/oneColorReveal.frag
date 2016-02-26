// the simple onecolor.frag shader with added reveal functionality

precision mediump float;

uniform vec4 u_color;
uniform vec4 u_revealColor;

// the Y coordinate in model space from where the fragments are revealed
uniform float u_revealStart;
// whether the front part (larger Y coordinates) of model is the one revealed
uniform bool u_revealFront;
// a gradient transition from white color will be added for this length after u_revealStart
uniform float u_revealTransitionLength;

// the coordinates of this fragment in model space
varying vec4 v_modelPos;
	
void main() {
    // discard fragments that are not revealed yet
    if ((u_revealFront==true) && (v_modelPos.y<=u_revealStart)) {
        discard;
    } else
    if ((u_revealFront==false) && (v_modelPos.y>=u_revealStart)) {
        discard;
    // calculate the color of the revealed fragments
    } else {
        vec4 color = u_color;

        // add a u_revealTransitionLength long transition from white to the calculated color from the start of reveal
        if ((u_revealFront==true) && (v_modelPos.y<=u_revealStart+u_revealTransitionLength)) {
            float factor = (v_modelPos.y-u_revealStart)/u_revealTransitionLength;
            color = color * factor + u_revealColor * (1.0-factor);
        } else
        if ((u_revealFront==false) && (v_modelPos.y>=u_revealStart-u_revealTransitionLength)) {
            float factor = (u_revealStart-v_modelPos.y)/u_revealTransitionLength;
            color = color * factor + u_revealColor * (1.0-factor);
        }

	gl_FragColor = color;
    }
}
