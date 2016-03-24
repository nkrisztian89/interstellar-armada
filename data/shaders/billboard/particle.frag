precision mediump float;
	
// common uniforms
uniform sampler2D u_emissiveTexture;

// instance uniforms
uniform vec4 u_color;
	
varying vec2 v_texCoord;
	
void main() {
	gl_FragColor = 
		u_color * texture2D(u_emissiveTexture, v_texCoord);
}
