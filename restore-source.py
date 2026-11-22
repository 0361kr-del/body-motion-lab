"""Restore the complete source and models from the verified archive chunks."""
import hashlib, io, pathlib, zipfile
root = pathlib.Path(__file__).resolve().parent
data = b''.join(p.read_bytes() for p in sorted((root/'.bootstrap').glob('part-*')))
assert hashlib.sha256(data).hexdigest() == '71a420cc7e19021f6e34d6b0de17e585ff76e8e34a0c1c4924a453b16b671bd5', 'Archive checksum mismatch'
with zipfile.ZipFile(io.BytesIO(data)) as z:
    assert z.testzip() is None
    for name in z.namelist():
        p = pathlib.PurePosixPath(name)
        assert not p.is_absolute() and '..' not in p.parts
    z.extractall(root/'site-source')
print('Source restored to site-source/. See site-source/README_KO.md.')
