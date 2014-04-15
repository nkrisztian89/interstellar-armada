precision mediump float;
	
// our texture
uniform sampler2D u_image;
	
// the texCoords passed in from the vertex shader.
varying vec2 v_texCoord;
	
void main() {
	gl_FragColor = 
		//vec4(v_texCoord.xy,0.0,1.0);
		//vec4(v_texCoord.x,0.0,0.0,1.0);
		texture2D(u_image, v_texCoord);
}
