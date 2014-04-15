attribute vec3 a_position;

varying vec3 v_position;

void main() {
	gl_Position = vec4(a_position,1.0);
	v_position = a_position;
}
