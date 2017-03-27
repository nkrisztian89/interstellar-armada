precision mediump float;
	
// our texture
uniform sampler2D u_emissiveTexture;

uniform vec4 u_color;
	
// the texCoords passed in from the vertex shader.
varying mediump vec2 v_texCoord;
	
void main() {
	gl_FragColor = u_color *
		texture2D(u_emissiveTexture, v_texCoord);
}
