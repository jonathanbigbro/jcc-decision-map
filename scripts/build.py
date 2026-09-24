"""Build the self-contained local app using only Python's standard library."""
import argparse
import json
import pathlib
import shutil
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]


def build(output):
    src = ROOT / 'src'
    public = ROOT / 'public'
    output = output.resolve()
    if output == ROOT or output in ROOT.parents or output == src or output == public:
        raise ValueError('Choose a separate build output directory, such as dist/')
    output.mkdir(parents=True, exist_ok=True)
    html = (src / 'index.html').read_text(encoding='utf-8')
    replacements = {}
    for marker, filename in [('STYLES', 'styles.css'), ('APP', 'app.js'),
                             ('SYNERGY_APP', 'synergy-app.js'), ('VERSION', 'version.js')]:
        replacements[marker] = (src / filename).read_text(encoding='utf-8')
    for marker, filename, variable in [('DATA', 'data.json', 'DATA'),
                                       ('SYNERGY_DATA', 'synergies.json', 'SYNERGIES')]:
        data = json.loads((src / filename).read_text(encoding='utf-8'))
        serialized = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
        replacements[marker] = f'const {variable} = {serialized};'
    replacements['SYNERGY_ENGINE'] = (src / 'synergy-engine.mjs').read_text(encoding='utf-8').replace('export ', '')
    replacements['ENGINE'] = (src / 'engine.mjs').read_text(encoding='utf-8').replace(
        "import {comboBonus} from './synergy-engine.mjs';", '').replace('export ', '')
    for marker, content in replacements.items():
        token = f'/* {marker} */'
        if html.count(token) != 1:
            raise ValueError(f'Expected one template placeholder for {marker}')
        html = html.replace(token, content)
    for directory in ['assets', 'vendor']:
        shutil.copytree(public / directory, output / directory, dirs_exist_ok=True)
    (output / 'index.html').write_text(html, encoding='utf-8')
    shutil.copy2(src / 'server.py', output / 'server.py')
    shutil.copy2(ROOT / 'USER_GUIDE.md', output / '使用说明.md')
    shutil.copy2(ROOT / 'THIRD_PARTY_NOTICES.md', output / 'THIRD_PARTY_NOTICES.md')
    launcher = ('@echo off\r\ncd /d "%~dp0"\r\n'
                'python --version >nul 2>&1\r\n'
                'if errorlevel 1 (\r\n  echo Python 3.10+ is required.\r\n  pause\r\n  exit /b 1\r\n)\r\n'
                'start "" http://127.0.0.1:8765/\r\npython server.py --port 8765\r\npause\r\n')
    (output / '启动定阵导航.cmd').write_bytes(launcher.encode('utf-8'))
    return output


def archive(output, destination):
    destination = destination.resolve()
    if output == destination or output in destination.parents:
        raise ValueError('Place the archive outside the build directory')
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as bundle:
        for path in sorted(output.rglob('*')):
            if path.is_file() and '__pycache__' not in path.parts and path.suffix != '.pyc':
                bundle.write(path, 'jcc-decision-map/' + path.relative_to(output).as_posix())
    return destination


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=pathlib.Path, default=ROOT / 'dist')
    parser.add_argument('--zip', dest='archive_path', type=pathlib.Path)
    args = parser.parse_args()
    output = build(args.output)
    print(f'Built: {output}')
    if args.archive_path:
        print(f'Packaged: {archive(output, args.archive_path)}')


if __name__ == '__main__':
    main()
