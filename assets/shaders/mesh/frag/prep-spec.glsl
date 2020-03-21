vec4 texSpec = texture2D(u_specularTexture, v_texCoord);
vec3 viewDir = normalize(v_viewDir);
float shininess = texSpec.a * MAX_SHININESS;