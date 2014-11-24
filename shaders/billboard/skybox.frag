precision mediump float;

uniform mat4 u_viewDirectionProjectionInverse;
uniform samplerCube u_skybox;

varying vec3 v_position;

void main() {
    vec4 t = u_viewDirectionProjectionInverse * vec4(v_position,1.0);
    gl_FragColor = 
        textureCube(u_skybox,normalize(t.xyz/t.w));
}
