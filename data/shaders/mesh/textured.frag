#version 100

precision mediump float;

uniform sampler2D u_diffuseTexture;
	
varying mediump vec2 v_texCoord;
varying lowp vec4 v_color;

void main() {
    gl_FragColor = v_color * texture2D(u_diffuseTexture, v_texCoord);
}