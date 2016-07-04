precision mediump float;
	
// our texture
uniform sampler2D u_emissiveTexture;
	
// the texCoords passed in from the vertex shader.
varying mediump vec2 v_texCoord;
	
void main() {
	gl_FragColor = 
		texture2D(u_emissiveTexture, v_texCoord);
}
