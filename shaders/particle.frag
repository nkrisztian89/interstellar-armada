precision mediump float;
	
// our texture
uniform sampler2D u_image;
uniform vec3 u_color;
	
// the texCoords passed in from the vertex shader.
varying vec2 v_texCoord;
	
void main() {
	gl_FragColor = 
		vec4(u_color,1.0)*texture2D(u_image, v_texCoord);
}
