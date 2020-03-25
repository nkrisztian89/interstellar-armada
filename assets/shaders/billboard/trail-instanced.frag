precision mediump float;
	
// common uniforms
uniform sampler2D u_emissiveTexture;
	
// varyings
varying mediump vec2 v_texCoord;
varying lowp vec4 v_color;
	
void main() {
	gl_FragColor = v_color *
		texture2D(u_emissiveTexture, v_texCoord);
}
