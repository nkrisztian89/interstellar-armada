precision mediump float;
	
// our texture
uniform sampler2D u_image;
uniform vec3 u_lightDir;
uniform vec3 u_eyePos;

	
// the texCoords passed in from the vertex shader.
varying vec2 v_texCoord;
varying vec3 v_normal;
varying vec4 v_color;
varying float v_luminosity;
varying float v_shininess;

varying vec4 v_worldPos;

	
void main() {
	gl_FragColor = vec4(0,1,0,1);
}
