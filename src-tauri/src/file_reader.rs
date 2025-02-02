use std::fs;
use std::io::Error;
use std::path::Path;

const SUPPORTED_AUDIO_EXTENSIONS: [&str; 12] = [
    "mp3", "flac", "wav", "ogg", "m4a", "wma", "aac", "riff", "aiff", "mp2", "mp4", "mkv",
];

pub fn read_directory_files(dirs: Vec<String>) -> Result<Vec<String>, Error> {
    let mut audio_files = Vec::new();

    for dir in dirs {
        let sub_files = read_dir_files(&dir)?;
        let filtered_files = filter_audio_files(&sub_files);
        audio_files.extend(filtered_files);
    }

    Ok(audio_files)
}

fn read_dir_files(dir: &str) -> Result<Vec<String>, Error> {
    let paths = fs::read_dir(dir)?;
    let mut files = Vec::new();

    for entry in paths {
        let entry = entry?;
        let path = entry.path();

        if path.is_file() {
            if let Some(path_str) = path.to_str() {
                files.push(path_str.to_string());
            }
        } else if path.is_dir() {
            // Recursively read subdirectories
            let sub_files = read_dir_files(path.to_str().unwrap_or_default())?;
            files.extend(sub_files);
        }
    }

    Ok(files)
}

fn filter_audio_files(paths: &[String]) -> Vec<String> {
    paths
        .iter()
        .filter(|path| {
            let path_obj = Path::new(path);
            !path_obj
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap()
                .starts_with(".")
        }) // filter out hidden files
        .filter_map(|path| {
            let path_obj = Path::new(path);
            let extension = path_obj
                .extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| ext.to_lowercase());

            match extension {
                Some(ext) if SUPPORTED_AUDIO_EXTENSIONS.contains(&ext.as_str()) => {
                    Some(path.clone())
                }
                _ => None,
            }
        })
        .collect()
}
