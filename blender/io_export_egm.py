import bpy
from bpy.props import (
    StringProperty,
)
from bpy_extras.io_utils import (
    ExportHelper,
)
from bpy.types import (
    Operator,
)

bl_info = {
    "name": "EgomModel export",
    "author": "Krisztián Nagy",
    "version": (1, 0, 0),
    "blender": (3, 5, 1),
    "location": "File > Import-Export",
    "description": "Adds support to export models in the EgomModel (.egm) file format, version 3.6",
    "category": "Import-Export",
    "support": "COMMUNITY",
}

# Vertex group weights are multiplied by this factor to get EGM group index
# values
WEIGHT_FACTOR = 1000


# Get EGM group index from VertexGroupElement 'group'
def get_group_index_from_group(group):
    return round(group.weight * WEIGHT_FACTOR)


# Get EGM group index for MeshPolygon 'polygon' inside object 'ob' of
# group with index 'group'
def get_group_index(ob, polygon, group):
    index = 0
    vertices = ob.data.vertices
    for i in range(len(polygon.vertices)):
        v = vertices[polygon.vertices[i]]
        for g in v.groups:
            if g.group == group:
                group_index = get_group_index_from_group(g)
                if i == 0:
                    index = group_index
                else:
                    if index != group_index:
                        return 0
    return index


# Convert float to string with rounding (max 4 decimals)
def f2s(x):
    return f'{(round(x * 10000) / 10000):g}'


# Convert float to string with rounding (max 3 decimals)
def f2s3(x):
    return f'{(round(x * 1000) / 1000):g}'


def get_lod_from_object(ob, minLOD, maxLOD):
    if 'minLOD' in ob:
        obMinLOD = ob['minLOD']
    elif 'minLOD' in ob.data:
        obMinLOD = ob.data['minLOD']
    else:
        obMinLOD = minLOD
    if 'maxLOD' in ob:
        obMaxLOD = ob['maxLOD']
    elif 'maxLOD' in ob.data:
        obMaxLOD = ob.data['maxLOD']
    else:
        obMaxLOD = maxLOD
    return (obMinLOD, obMaxLOD)


def get_lod_string(ob, minLOD, maxLOD):
    (obMinLOD, obMaxLOD) = get_lod_from_object(ob, minLOD, maxLOD)
    if obMinLOD != minLOD or obMaxLOD != maxLOD:
        return ","+str(obMinLOD)+","+str(obMaxLOD)
    else:
        return ""


# Return the color to be exported for the passed blender material
def get_color(material):
    # Materials created by the EGM importer have a node group with the color
    # passed in as the input
    if 'Group' in material.node_tree.nodes:
        gr = material.node_tree.nodes['Group']
        return gr.inputs['Color'].default_value
    # If not created by the importer, export the default color value of the
    # default BSDF shader, if it exists
    if 'Principled BSDF' in material.node_tree.nodes:
        pr = material.node_tree.nodes['Principled BSDF']
        return pr.inputs['Base Color'].default_value
    else:
        return [1, 1, 1, 1]


def vec_eq(v1, v2):
    return v1[0] == v2[0] and v1[1] == v2[1] and v1[2] == v2[2]


# [[1,2],[3,4]] -> [1,2,3,4]
def flatten(nested_list):
    return [item for sub_list in nested_list for item in sub_list]


def get_triangles(obs, vstart, minLOD, maxLOD, transparent):
    ttext = []
    prev_lu = 0
    prev_tr = 0
    prev_mat = 0
    prev_normals = []
    oindex = 0
    vcount = 3
    uvs = []
    for ob in obs:
        lod_string = get_lod_string(ob, minLOD, maxLOD)
        # Calculate split normals
        ob.data.calc_normals_split()
        # Determine the indices of the transform and luminosity vertex groups,
        # if they exist
        if 'transform' in ob.vertex_groups:
            tra = ob.vertex_groups['transform'].index
        else:
            tra = -1
        if 'luminosity' in ob.vertex_groups:
            lum = ob.vertex_groups['luminosity'].index
        else:
            lum = -1
        first = True
        uv = ob.data.uv_layers.active.data
        split_normals = [loop.normal for loop in ob.data.loops]
        for p in ob.data.polygons:
            # Skip transparent triangles for opaque list and vice versa
            mat = obs[0].material_slots[p.material_index].material
            if (get_color(mat)[3] < 1) != transparent:
                continue
            tt = "[["
            start = vstart[oindex]
            # Vertex indices
            vertices = p.vertices
            # vertices is a bpy_prop_array, not an array, so this doesn't work:
            # index = vertices.index(min(vertices))
            minv = min(vertices)
            index = -1
            for i in range(len(vertices)):
                if vertices[i] == minv:
                    index = i
                    break
            if len(vertices) != vcount:
                vcount = len(vertices)
                tt += str(-vcount) + ","
            index_map = [index + i for i in range(vcount - index)]
            index_map += [i for i in range(index)]
            tt += str(start + vertices[index])
            for i in range(1, vcount):
                tt += "," + str(vertices[index_map[i]] - vertices[index])
            # Color
            if p.material_index != prev_mat:
                tt += "," + str(p.material_index)
                prev_mat = p.material_index
            # Texture coordinates
            if (first or (
                  len(uvs) != vcount*2 or
                  not all([
                    uvs[i*2] == uv[p.loop_indices[index_map[i]]].uv[0] and
                    uvs[i*2+1] == 1 - uv[p.loop_indices[index_map[i]]].uv[1]
                    for i in range(vcount)
                  ]))):
                uvs = flatten([[
                      uv[p.loop_indices[index_map[i]]].uv[0],
                      1 - uv[p.loop_indices[index_map[i]]].uv[1]]
                    for i in range(vcount)
                  ])
                tt += "," + ",".join(map(f2s3, uvs))
            # LOD
            if first:
                tt += lod_string
                first = False
            tt += "]"
            # Normal vectors
            normals = [split_normals[i] for i in p.loop_indices]
            normals = [normals[index_map[i]] for i in range(vcount)]
            # normals = split_normals[p.loop_indices]
            normals_written = False
            # Check if we have split normals differing from the main one
            if not all([
                normals[i][0] == p.normal.x and
                normals[i][1] == p.normal.y and
                normals[i][2] == p.normal.z
                for i in range(vcount)
            ]):
                # Check if our split normals are different from the ones of the
                # previous triangle
                if (len(prev_normals) != vcount
                    or not all(
                    [vec_eq(prev_normals[i], normals[i])
                     for i in range(vcount)
                     ])):
                    tt += ",[" + ",".join(map(f2s, flatten([[
                        normals[i][0],
                        normals[i][1],
                        normals[i][2]
                    ] for i in range(vcount)])))
                    prev_normals = normals
                    normals_written = True
            else:
                # Check if the main normal is different from the one of the
                # previous triangle
                if (len(prev_normals) != 1 or
                   p.normal.x != prev_normals[0][0] or
                   p.normal.y != prev_normals[0][1] or
                   p.normal.z != prev_normals[0][2]):
                    tt += (",["
                           + f2s(p.normal.x) + ","
                           + f2s(p.normal.y) + ","
                           + f2s(p.normal.z))
                    prev_normals = [[p.normal.x, p.normal.y, p.normal.z]]
                    normals_written = True
            # Group indices
            tr = 0
            lu = 0
            if tra >= 0:
                tr = get_group_index(ob, p, tra)
            if lum >= 0:
                lu = get_group_index(ob, p, lum)
            if tr == prev_tr and lu == prev_lu:
                if normals_written:
                    tt += "]"
            else:
                if not normals_written:
                    tt += ",["
                else:
                    tt += ","
                tt += str(tr)+","+str(lu)+"]"
            prev_tr = tr
            prev_lu = lu
            tt += "]"
            ttext.append(tt)
        oindex += 1
    return ",".join(ttext)


# Export blender objects 'obs' into an EgomModel file at 'path'
def write_egm(path, obs):
    # Determining minimum and maximum LOD considering all of the objects
    minLOD = 999
    maxLOD = -1
    for ob in obs:
        # Min and max LOD for an object can be specified in the custom
        # properties 'minLOD' and 'maxLOD'
        if 'minLOD' in ob:
            minLOD = min(minLOD, ob['minLOD'])
        elif 'minLOD' in ob.data:
            minLOD = min(minLOD, ob.data['minLOD'])
        if 'maxLOD' in ob:
            maxLOD = max(maxLOD, ob['maxLOD'])
        elif 'maxLOD' in ob.data:
            maxLOD = max(maxLOD, ob.data['maxLOD'])
    # Default values in case none was specified in the objects
    if minLOD >= 999:
        minLOD = 0
    if maxLOD < 0:
        maxLOD = 4
    # Write file header
    f = open(path, "w")
    f.write('{"format":"EgomModel","version":"3.6","info":{"name":"'
            + bpy.path.clean_name(obs[0].name)
            + '","author":"Krisztian Nagy","scale":'
            + f2s3(obs[0].scale[0])
            + ',"LOD":[' + str(minLOD) + ',' + str(maxLOD)
            + '],"colorPalette":[')
    # Export color palette based on the materials of the first object
    # All objects must share the same materials in the same slots
    mtext = []
    for m in obs[0].material_slots:
        color = get_color(m.material)
        mtext.append("["
                     + f2s3(color[0]) + ","
                     + f2s3(color[1]) + ","
                     + f2s3(color[2]) + ","
                     + f2s3(color[3]) + "]")
    f.write(",".join(mtext))
    # Export vertices
    f.write(']},"vertices":[')
    vtext = []
    vstart = []
    vindex = 0
    for ob in obs:
        (obMinLOD, obMaxLOD) = get_lod_from_object(ob, minLOD, maxLOD)
        lod_string = get_lod_string(ob, minLOD, maxLOD)
        vertices = ob.data.vertices
        first = True
        vstart.append(vindex)
        vindex += len(vertices)
        for v in vertices:
            vtext.append("["
                         + f2s3(v.co[0]) + ","
                         + f2s3(v.co[1]) + ","
                         + f2s3(v.co[2]) +
                         (lod_string if first else "") + "]")
            first = False
    f.write(",".join(vtext))
    # Export polygons
    f.write('],"polygons":[')
    opaque_triangles = get_triangles(obs, vstart, minLOD, maxLOD, False)
    transparent_triangles = get_triangles(obs, vstart, minLOD, maxLOD, True)

    f.write(opaque_triangles)
    if opaque_triangles and transparent_triangles:
        f.write(",")
    f.write(transparent_triangles)
    f.write("]}")
    f.close()


class ExportEGM(Operator, ExportHelper):
    bl_idname = "export_mesh.egm"
    bl_label = "Export EGM"
    bl_description = """Save mesh data in EgomModel format"""

    filename_ext = ".egm"
    filter_glob: StringProperty(default="*.egm", options={'HIDDEN'})

    def execute(self, context):
        write_egm(self.filepath, context.selected_objects)
        return {'FINISHED'}

    def draw(self, context):
        pass


def menu_export(self, context):
    self.layout.operator(ExportEGM.bl_idname, text="EgomModel (.egm)")


classes = (
    ExportEGM,
)


def register():
    for cls in classes:
        bpy.utils.register_class(cls)
    bpy.types.TOPBAR_MT_file_export.append(menu_export)


def unregister():
    for cls in classes:
        bpy.utils.unregister_class(cls)
    bpy.types.TOPBAR_MT_file_export.remove(menu_export)


if __name__ == "__main__":
    register()
