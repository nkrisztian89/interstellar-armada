precision mediump float;
	
uniform vec3 u_color;
uniform float u_length;

varying vec3 v_position;
varying float v_dist;
	
void main() {
    gl_FragColor = vec4(u_color.rgb,((1.0-v_dist)*(1.0-v_position.x))/(u_length/200.0));
}
