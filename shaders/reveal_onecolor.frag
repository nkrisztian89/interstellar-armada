precision mediump float;
	
// our texture
uniform sampler2D u_image;
uniform vec3 u_lightDir;
uniform vec3 u_eyePos;
uniform vec4 u_color;

uniform float u_revealStart;
uniform float u_revealEnd;
uniform bool u_revealFrontToBack;

	
// the texCoords passed in from the vertex shader.
varying vec2 v_texCoord;
varying vec3 v_normal;
varying vec4 v_color;
varying float v_luminosity;
varying float v_shininess;

varying vec4 v_worldPos;
varying vec4 v_modelPos;

	
void main() {
	vec4 color = u_color;
		
	if ((u_revealFrontToBack==true) && (v_modelPos.y<=u_revealEnd)) {
		discard;
	} else
	if ((u_revealFrontToBack==false) && (v_modelPos.y>=u_revealEnd)) {
		discard;
	} else
	if ((u_revealFrontToBack==true) && (v_modelPos.y>=u_revealEnd) && (v_modelPos.y<u_revealStart)) {
		color=vec4(1.0,1.0,1.0,1.0);
	}
	if ((u_revealFrontToBack && (v_modelPos.y>=u_revealStart) && (v_modelPos.y<u_revealStart+(u_revealStart-u_revealEnd)))) {
		float factor = 	(v_modelPos.y-u_revealStart)/(u_revealStart-u_revealEnd);
		color=color*factor+vec4(1.0,1.0,1.0,1.0)*(1.0-factor);
	}
	gl_FragColor = color;
}
