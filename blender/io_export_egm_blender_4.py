from typing import (
    cast
)

import bpy
from bpy.props import (
    IntProperty,
    StringProperty,
)
from bpy.types import (
    bpy_prop_collection,
    MeshPolygon,
    Object,
    Operator,
    VertexGroupElement,
)
from bpy_extras.io_utils import (
    ExportHelper,
)
from mathutils import (
    Vector,
)


bl_info = {
    "name": "EgomModel export",
    "author": "Krisztián Nagy",
    "version": (1, 0, 0),
    "blender": (4, 2, 1),
    "location": "File > Import-Export",
    "description": "Adds support to export models in the EgomModel (.egm) file format, version 3.6",
    "category": "Import-Export",
    "support": "COMMUNITY",
}

# Vertex group weights are multiplied by this factor to get EGM group index
# values
WEIGHT_FACTOR = 1000


# Get EGM group index from VertexGroupElement 'group'
def get_group_index_from_group(group: VertexGroupElement) -> int:
    return round(group.weight * WEIGHT_FACTOR)


# Get EGM group index for MeshPolygon 'polygon' inside object 'ob' of
# group with index 'group'
def get_group_index(ob: Object, polygon: MeshPolygon, group: int) -> int:
    index = 0
    vertices = ob.data.vertices
    for i in range(len(polygon.vertices)):
        v = vertices[polygon.vertices[i]]
        group_index = 0
        for g in v.groups:
            if g.group == group:
                group_index = get_group_index_from_group(g)
                break
        if i == 0:
            if group_index == 0:
                return 0
            index = group_index
        else:
            if index != group_index:
                return 0
    return index


def round3(x):
    return round(x * 1000) / 1000


def round4(x):
    return round(x * 10000) / 10000


# Convert float to string with rounding (max 3 decimals)
def f2s3(x):
    return f'{(round(x * 1000) / 1000):g}'


# Convert float to string with rounding (max 4 decimals)
def f2s4(x):
    return f'{(round(x * 10000) / 10000):g}'


def get_lod_from_object(ob: Object, minLOD: int, maxLOD: int):
    if 'minLOD' in ob:
        obMinLOD = max(ob['minLOD'], minLOD)
    elif 'minLOD' in ob.data:
        obMinLOD = max(ob.data['minLOD'], minLOD)
    else:
        obMinLOD = minLOD
    if 'maxLOD' in ob:
        obMaxLOD = min(ob['maxLOD'], maxLOD)
    elif 'maxLOD' in ob.data:
        obMaxLOD = min(ob.data['maxLOD'], maxLOD)
    else:
        obMaxLOD = maxLOD
    return (obMinLOD, obMaxLOD)


def get_lod_string(ob: Object, minLOD: int, maxLOD: int):
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


# [[1,2],[3,4]] -> [1,2,3,4]
def flatten(nested_list):
    return [item for sub_list in nested_list for item in sub_list]


def get_triangles(obs: list[Object],
                  vstart: list[int],
                  vertex_indices: list[int],
                  minLOD: int,
                  maxLOD: int,
                  transparent: bool) -> str:

    polygon_data: list[list[float | int]] = []
    oindex = 0

    # Checks if two polygon data entries have the same information except for
    # their LOD ranges
    def polygons_match(p1, p2):
        return (len(p1) == len(p2) and
                all([p1[i] == p2[i] for i in range(len(p1) - 2)]))

    # Compile all the relevant data from p into an array and add it to
    # polygon_data if it doesn't yet have an entry with the same data (except
    # for LOD). If it already has a polygon with the same data, expand the LOD
    # range of that polygon to include the passed one.
    def add_polygon(p: MeshPolygon,
                    obMinLOD: int,
                    obMaxLOD: int,
                    ob: Object,
                    uv: bpy_prop_collection,
                    split_normals: list[Vector],
                    tra: int,
                    lum: int):
        # Vertex indices
        start = vstart[oindex]  # The index for the first vertex of this object
        #                         in the vertex_indices array
        vcount = len(p.vertices)
        # We collect the vertex indices for the deduplicated common vertex
        # array for this polygon's vertices
        vertices = [vertex_indices[i + start] for i in p.vertices]
        # In egm files we always start with the lowest vertex index for each
        # polygon, so we create a mapping from blender's vertex order to this
        # reordered vertex list into index_map
        index = vertices.index(min(vertices))
        index_map = [index + i for i in range(vcount - index)]
        index_map += [i for i in range(index)]
        # Collect the resulting vertex data into the array:
        # Vertex count, start vertex index, vertex index offsets for the rest
        pdata = [vcount, vertices[index]]
        for i in range(1, vcount):
            pdata.append(vertices[index_map[i]] - vertices[index])
        # Color
        pdata.append(p.material_index)
        # Texture coordinates
        pdata += map(round3, flatten([[
              uv[p.loop_indices[index_map[i]]].uv[0],
              1 - uv[p.loop_indices[index_map[i]]].uv[1]]
            for i in range(vcount)
          ]))
        # Normal vectors
        normals = [split_normals[i] for i in p.loop_indices]
        normals = [normals[index_map[i]] for i in range(vcount)]
        has_split_normals = not all([
                normals[i][0] == p.normal.x and
                normals[i][1] == p.normal.y and
                normals[i][2] == p.normal.z
                for i in range(vcount)
            ])
        pdata.append(1 if has_split_normals else 0)
        if has_split_normals:
            pdata += map(round4, flatten(normals))
        else:
            pdata += map(round4, [p.normal.x, p.normal.y, p.normal.z])
        # Group indices
        tr = 0
        lu = 0
        if tra >= 0:
            tr = get_group_index(ob, p, tra)
        if lum >= 0:
            lu = get_group_index(ob, p, lum)
        pdata += [tr, lu]
        # LOD
        pdata += [obMinLOD, obMaxLOD]
        for p2 in polygon_data:
            if polygons_match(pdata, p2):
                p2[-2] = min(p2[-2], obMinLOD)
                p2[-1] = max(p2[-1], obMaxLOD)
                return
        polygon_data.append(pdata)

    # Collect all the polygon data from all the objects in an unduplicated way
    # into the polygon_data array
    for ob in obs:
        (obMinLOD, obMaxLOD) = get_lod_from_object(ob, minLOD, maxLOD)
        if obMinLOD > maxLOD or obMaxLOD < minLOD:
            continue
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
        uv = ob.data.uv_layers.active.data
        split_normals = [n.vector for n in ob.data.corner_normals]
        for p in ob.data.polygons:
            # Skip transparent triangles for opaque list and vice versa
            mat = obs[0].material_slots[p.material_index].material
            if (get_color(mat)[3] < 1) != transparent:
                continue
            add_polygon(p, obMinLOD, obMaxLOD, ob, uv, split_normals, tra, lum)
        oindex += 1

    # Convert the unduplicated polygon data to a string that can be written
    # to the EGM file
    ttext: list[str] = []
    vcount = 0
    prev_mat = -1
    prev_normals: list[float] = []
    prev_lu = -1
    prev_tr = -1
    prevMinLOD = -1
    prevMaxLOD = -1
    uvs: list[float] = []

    for polygon in polygon_data:
        tt = "[["
        # Vertex count
        if polygon[0] != vcount:
            vcount = cast(int, polygon[0])
            tt += str(-vcount) + ","
        # Vertex indices
        tt += str(polygon[1])
        for i in range(2, vcount + 1):
            tt += "," + str(polygon[i])
        pdi = vcount + 1
        # Color
        if polygon[pdi] != prev_mat:
            tt += "," + str(polygon[pdi])
            prev_mat = cast(int, polygon[pdi])
        pdi += 1
        # Texture coordinates
        if (len(uvs) != vcount*2 or
            not all([
              uvs[i*2] == polygon[pdi+i*2] and
              uvs[i*2+1] == polygon[pdi+i*2+1]
              for i in range(vcount)
             ])):
            uvs = polygon[pdi:pdi + vcount*2]
            tt += "," + ",".join(map(f2s3, uvs))
        pdi += vcount*2
        # LOD
        if polygon[-2] != prevMinLOD or polygon[-1] != prevMaxLOD:
            tt += f',{polygon[-2]},{polygon[-1]}'
            prevMinLOD = cast(int, polygon[-2])
            prevMaxLOD = cast(int, polygon[-1])
        tt += "]"
        # Normal vectors
        has_split_normals = polygon[pdi] == 1
        pdi += 1
        if has_split_normals:
            normals = polygon[pdi:pdi + 3*vcount]
        else:
            normals = polygon[pdi:pdi + 3]
        normals_written = False
        # Check if our normals are different from the ones of the
        # previous triangle
        if (len(prev_normals) != len(normals)
            or not all(
            [prev_normals[i] == normals[i]
             for i in range(len(normals))
             ])):
            tt += ",[" + ",".join(map(f2s4, normals))
            prev_normals = normals
            normals_written = True
        pdi += len(normals)
        # Group indices
        tr = polygon[pdi]
        lu = polygon[pdi+1]
        if tr == prev_tr and lu == prev_lu:
            if normals_written:
                tt += "]"
        else:
            if not normals_written:
                tt += ",["
            else:
                tt += ","
            tt += f'{tr},{lu}]'
        prev_tr = cast(int, tr)
        prev_lu = cast(int, lu)
        tt += "]"
        ttext.append(tt)

    return ",".join(ttext)


# Determine minimum and maximum LOD considering the passed objects
def determine_lod_range(obs: list[Object]):
    minLOD = 999
    maxLOD = -1
    for ob in obs:
        # Min and max LOD for an object can be specified in the custom
        # properties 'minLOD' and 'maxLOD'
        if 'minLOD' in ob:
            minLOD = min(minLOD, ob['minLOD'])
        elif 'data' in ob and 'minLOD' in ob.data:
            minLOD = min(minLOD, ob.data['minLOD'])
        if 'maxLOD' in ob:
            maxLOD = max(maxLOD, ob['maxLOD'])
        elif 'data' in ob and 'maxLOD' in ob.data:
            maxLOD = max(maxLOD, ob.data['maxLOD'])
    # Default values in case none was specified in the objects
    if minLOD >= 999:
        minLOD = 0
    if maxLOD < 0:
        maxLOD = 4
    return (minLOD, maxLOD)


# Export blender objects 'obs' into an EgomModel file at 'path'
def write_egm(path, obs, props):
    minLOD = props.min_lod
    maxLOD = props.max_lod
    # Write file header
    f = open(path, "w")
    f.write('{"format":"EgomModel","version":"3.6","info":{"name":"'
            + props.model_name
            + '","author":"' + props.author + '","scale":'
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
    vertex_data = []
    vertex_indices = []

    def add_vertex(v, obMinLOD, obMaxLOD):
        vdata = [
            round3(v.co[0]),
            round3(v.co[1]),
            round3(v.co[2]),
            obMinLOD, obMaxLOD]
        for i in range(len(vertex_data)):
            vd = vertex_data[i]
            if vd[0] == vdata[0] and vd[1] == vdata[1] and vd[2] == vdata[2]:
                vd[3] = min(vd[3], obMinLOD)
                vd[4] = max(vd[4], obMaxLOD)
                vertex_indices.append(i)
                return
        vertex_indices.append(len(vertex_data))
        vertex_data.append(vdata)

    for ob in obs:
        (obMinLOD, obMaxLOD) = get_lod_from_object(ob, minLOD, maxLOD)
        if obMinLOD > maxLOD or obMaxLOD < minLOD:
            continue
        vertices = ob.data.vertices
        vstart.append(vindex)
        vindex += len(vertices)
        for v in vertices:
            add_vertex(v, obMinLOD, obMaxLOD)
    prevMinLOD = minLOD
    prevMaxLOD = maxLOD
    for vertex in vertex_data:
        vt = f'[{vertex[0]:g},{vertex[1]:g},{vertex[2]:g}'
        if vertex[3] != prevMinLOD or vertex[4] != prevMaxLOD:
            vt += f',{vertex[3]},{vertex[4]}'
            prevMinLOD = vertex[3]
            prevMaxLOD = vertex[4]
        vt += ']'
        vtext.append(vt)

    f.write(",".join(vtext))
    # Export polygons
    f.write('],"polygons":[')
    opaque_triangles = get_triangles(obs, vstart, vertex_indices, 
                                     minLOD, maxLOD, False)
    transparent_triangles = get_triangles(obs, vstart, vertex_indices,
                                          minLOD, maxLOD, True)

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
    
    model_name: StringProperty(
      name="Model name",
      description="The name of the model as written in the info section")
    author: StringProperty(
      name="Author",
      description="Name of the person who created the model",
      default="Krisztian Nagy")
    min_lod: IntProperty(
        name="Min LOD", description="The minimum level of detail (LOD) exported",
        default=0, min=0, max=4, subtype="UNSIGNED")
    max_lod: IntProperty(
        name="Max LOD", description="The maximum level of detail (LOD) exported",
        default=4, min=0, max=4, subtype="UNSIGNED")
        
    def invoke(self, context, event):
        obs = context.selected_objects
        self.properties.model_name = bpy.path.clean_name(obs[0].name)
        (minLOD, maxLOD) = determine_lod_range(obs)
        self.properties.min_lod = minLOD
        self.properties.max_lod = maxLOD
        wm = context.window_manager
        wm.fileselect_add(self)
        return {'RUNNING_MODAL'}

    def execute(self, context):
        obs = context.selected_objects
        write_egm(self.filepath, obs, self.properties)
        self.report({'INFO'}, "File saved successfully!")
        return {'FINISHED'}

    def draw(self, context):
        layout = self.layout
        layout.prop(self.properties, "model_name")
        layout.prop(self.properties, "author")
        layout.prop(self.properties, "min_lod")
        layout.prop(self.properties, "max_lod")


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
