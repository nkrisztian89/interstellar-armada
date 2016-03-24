precision mediump float;
	
// common uniforms
uniform sampler2D u_emissiveTexture;
	
varying vec2 v_texCoord;
varying vec4 v_color;
	
void main() {
	gl_FragColor = 
            v_color * texture2D(u_emissiveTexture, v_texCoord);
}
