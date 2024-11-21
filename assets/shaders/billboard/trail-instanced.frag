precision mediump float;
	
// common uniforms
uniform sampler2D u_emissiveTexture;
	
// varyings
varying mediump vec2 v_texCoord;
varying lowp vec4 v_startColor;
varying lowp vec4 v_endColor;
	
void main() {
	gl_FragColor = mix(v_endColor, v_startColor, v_texCoord.t) *
		texture2D(u_emissiveTexture, v_texCoord);
}
