// a shader that simply displays the color set in a uniform

precision mediump float;
	
uniform vec4 u_color;
	
void main() {
	gl_FragColor = u_color;
}