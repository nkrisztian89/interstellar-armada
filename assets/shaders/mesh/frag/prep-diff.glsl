vec4 texCol = texture2D(u_diffuseTexture, v_texCoord);
vec3 normal = normalize(v_normal);

vec4 diffuseColor = v_color * texCol;