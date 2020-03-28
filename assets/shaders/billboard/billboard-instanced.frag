precision mediump float;
	
// common uniforms
uniform sampler2D u_emissiveTexture;
	
// varyings
varying mediump vec2 v_texCoord;
varying lowp float v_opacity;
	
void main() {
	gl_FragColor = vec4(1.0, 1.0, 1.0, v_opacity) * texture2D(u_emissiveTexture, v_texCoord);
}
