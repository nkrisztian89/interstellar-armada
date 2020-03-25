precision mediump float;
	
// common uniforms
uniform sampler2D u_emissiveTexture;
	
// varyings
varying mediump vec2 v_texCoord;
	
void main() {
	gl_FragColor = texture2D(u_emissiveTexture, v_texCoord);
}
