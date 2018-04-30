attribute vec3 a_position;

varying vec2 v_texCoords;

void main() {
	gl_Position = vec4(a_position.xy * 0.5 + vec2(-0.5, 0.5), -1.0, 1.0);
        v_texCoords = vec2(0.5 - a_position.x * 0.5, 0.5 - a_position.y * 0.5);
}