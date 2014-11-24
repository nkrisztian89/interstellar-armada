// Simple shader that uses a texture modulated by vertex attribute colors.

precision mediump float;

uniform sampler2D u_colorTexture;
	
varying vec2 v_texCoord;
varying vec4 v_color;

void main() {
    gl_FragColor = v_color * texture2D(u_colorTexture, v_texCoord);
}