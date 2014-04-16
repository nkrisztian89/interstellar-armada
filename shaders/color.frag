precision mediump float;
	
uniform vec3 u_color;

varying vec3 v_position;
	
void main() {
	gl_FragColor = vec4(u_color.rgb,1.0-v_position.x);
}
