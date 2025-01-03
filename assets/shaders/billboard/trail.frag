precision mediump float;
	
// common uniforms
uniform sampler2D u_emissiveTexture;
	
// instance uniforms
uniform lowp vec4 u_startColor;
uniform lowp vec4 u_endColor;
	
// varyings
varying mediump vec2 v_texCoord;
	
void main() {
	gl_FragColor = mix(u_endColor, u_startColor, v_texCoord.t) *
		texture2D(u_emissiveTexture, v_texCoord);
}
