use calamine::{open_workbook_auto, Reader};
use chrono::Local;
use rusqlite::{params, Connection};
use serde::Serialize;
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
};
use tauri::Manager;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Dataset {
    id: i64,
    name: String,
    source_file: String,
    extension: String,
    imported_at: String,
    row_count: usize,
    columns: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct QueryResult {
    columns: Vec<String>,
    rows: Vec<Vec<String>>,
    total: usize,
}

#[derive(Serialize)]
struct AggregateRow {
    key: String,
    value: f64,
    count: usize,
}

fn database_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory.join("local-analytics.sqlite3"))
}

fn connect(app: &tauri::AppHandle) -> Result<Connection, String> {
    let connection = Connection::open(database_path(app)?).map_err(|error| error.to_string())?;
    connection.execute_batch(
        "PRAGMA foreign_keys = ON;
         CREATE TABLE IF NOT EXISTS datasets (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           name TEXT NOT NULL,
           source_file TEXT NOT NULL,
           extension TEXT NOT NULL,
           imported_at TEXT NOT NULL,
           row_count INTEGER NOT NULL,
           columns_json TEXT NOT NULL
         );
         CREATE TABLE IF NOT EXISTS dataset_rows (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
           row_number INTEGER NOT NULL,
           data_json TEXT NOT NULL
         );
         CREATE INDEX IF NOT EXISTS idx_dataset_rows_dataset ON dataset_rows(dataset_id, row_number);"
    ).map_err(|error| error.to_string())?;
    Ok(connection)
}

fn unique_headers(values: Vec<String>) -> Vec<String> {
    let mut seen: HashMap<String, usize> = HashMap::new();
    values
        .into_iter()
        .enumerate()
        .map(|(index, value)| {
            let base = if value.trim().is_empty() {
                format!("字段{}", index + 1)
            } else {
                value.trim().to_string()
            };
            let count = seen.entry(base.clone()).or_insert(0);
            *count += 1;
            if *count == 1 {
                base
            } else {
                format!("{}({})", base, count)
            }
        })
        .collect()
}

fn read_tabular(path: &Path) -> Result<(Vec<String>, Vec<Vec<String>>), String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_lowercase();
    if extension == "csv" {
        let mut reader = csv::ReaderBuilder::new()
            .flexible(true)
            .from_path(path)
            .map_err(|error| error.to_string())?;
        let headers = unique_headers(
            reader
                .headers()
                .map_err(|error| error.to_string())?
                .iter()
                .map(String::from)
                .collect(),
        );
        let mut rows = Vec::new();
        for record in reader.records() {
            let record = record.map_err(|error| error.to_string())?;
            let mut row: Vec<String> = record.iter().map(String::from).collect();
            row.resize(headers.len(), String::new());
            row.truncate(headers.len());
            rows.push(row);
        }
        return Ok((headers, rows));
    }

    let mut workbook = open_workbook_auto(path).map_err(|error| error.to_string())?;
    let sheet_name = workbook
        .sheet_names()
        .first()
        .cloned()
        .ok_or("Excel文件没有可读取的工作表")?;
    let range = workbook
        .worksheet_range(&sheet_name)
        .map_err(|error| error.to_string())?;
    let mut source_rows = range.rows();
    let headers = unique_headers(
        source_rows
            .next()
            .ok_or("文件没有表头")?
            .iter()
            .map(ToString::to_string)
            .collect(),
    );
    let rows = source_rows
        .map(|values| {
            let mut row: Vec<String> = values.iter().map(ToString::to_string).collect();
            row.resize(headers.len(), String::new());
            row.truncate(headers.len());
            row
        })
        .collect();
    Ok((headers, rows))
}

fn dataset_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Dataset> {
    let columns_json: String = row.get(6)?;
    Ok(Dataset {
        id: row.get(0)?,
        name: row.get(1)?,
        source_file: row.get(2)?,
        extension: row.get(3)?,
        imported_at: row.get(4)?,
        row_count: row.get::<_, i64>(5)? as usize,
        columns: serde_json::from_str(&columns_json).unwrap_or_default(),
    })
}

#[tauri::command]
fn import_dataset(app: tauri::AppHandle, path: String) -> Result<Dataset, String> {
    let source = PathBuf::from(&path);
    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_lowercase();
    if !["csv", "xlsx", "xls"].contains(&extension.as_str()) {
        return Err("仅支持CSV、XLSX和XLS文件".into());
    }
    let (columns, rows) = read_tabular(&source)?;
    if columns.is_empty() {
        return Err("没有识别到字段".into());
    }
    let row_count = rows.len();
    let name = source
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("未命名数据集")
        .to_string();
    let source_file = source.to_string_lossy().to_string();
    let imported_at = Local::now().format("%Y-%m-%d %H:%M").to_string();
    let mut connection = connect(&app)?;
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    transaction.execute("INSERT INTO datasets(name,source_file,extension,imported_at,row_count,columns_json) VALUES(?1,?2,?3,?4,?5,?6)", params![name, source_file, extension, imported_at, row_count as i64, serde_json::to_string(&columns).unwrap()]).map_err(|error| error.to_string())?;
    let dataset_id = transaction.last_insert_rowid();
    {
        let mut insert = transaction
            .prepare("INSERT INTO dataset_rows(dataset_id,row_number,data_json) VALUES(?1,?2,?3)")
            .map_err(|error| error.to_string())?;
        for (index, row) in rows.iter().enumerate() {
            insert
                .execute(params![
                    dataset_id,
                    index as i64 + 1,
                    serde_json::to_string(row).unwrap()
                ])
                .map_err(|error| error.to_string())?;
        }
    }
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(Dataset {
        id: dataset_id,
        name,
        source_file,
        extension,
        imported_at,
        row_count,
        columns,
    })
}

#[tauri::command]
fn list_datasets(app: tauri::AppHandle) -> Result<Vec<Dataset>, String> {
    let connection = connect(&app)?;
    let mut statement = connection.prepare("SELECT id,name,source_file,extension,imported_at,row_count,columns_json FROM datasets ORDER BY id DESC").map_err(|error| error.to_string())?;
    let datasets = statement
        .query_map([], dataset_from_row)
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(datasets)
}

fn load_query_rows(
    connection: &Connection,
    dataset_id: i64,
    search: &str,
    limit: Option<usize>,
) -> Result<Vec<Vec<String>>, String> {
    let pattern = format!("%{}%", search);
    let sql = if limit.is_some() {
        "SELECT data_json FROM dataset_rows WHERE dataset_id=?1 AND (?2='' OR data_json LIKE ?3) ORDER BY row_number LIMIT ?4"
    } else {
        "SELECT data_json FROM dataset_rows WHERE dataset_id=?1 AND (?2='' OR data_json LIKE ?3) ORDER BY row_number"
    };
    let mut statement = connection.prepare(sql).map_err(|error| error.to_string())?;
    let mapper = |row: &rusqlite::Row<'_>| -> rusqlite::Result<Vec<String>> {
        let raw: String = row.get(0)?;
        Ok(serde_json::from_str(&raw).unwrap_or_default())
    };
    let rows = if let Some(value) = limit {
        statement
            .query_map(params![dataset_id, search, pattern, value as i64], mapper)
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
    } else {
        statement
            .query_map(params![dataset_id, search, pattern], mapper)
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
    }
    .map_err(|error| error.to_string())?;
    Ok(rows)
}

fn get_columns(connection: &Connection, dataset_id: i64) -> Result<Vec<String>, String> {
    let raw: String = connection
        .query_row(
            "SELECT columns_json FROM datasets WHERE id=?1",
            [dataset_id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    serde_json::from_str(&raw).map_err(|error| error.to_string())
}

#[tauri::command]
fn query_dataset(
    app: tauri::AppHandle,
    dataset_id: i64,
    search: String,
    limit: usize,
) -> Result<QueryResult, String> {
    let connection = connect(&app)?;
    let columns = get_columns(&connection, dataset_id)?;
    let rows = load_query_rows(&connection, dataset_id, &search, Some(limit.min(500)))?;
    let total: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM dataset_rows WHERE dataset_id=?1",
            [dataset_id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    Ok(QueryResult {
        columns,
        rows,
        total: total as usize,
    })
}

fn parse_number(value: &str) -> Option<f64> {
    let cleaned = value.trim().replace([',', '¥', '￥', '%'], "");
    cleaned.parse::<f64>().ok()
}

#[tauri::command]
fn aggregate_dataset(
    app: tauri::AppHandle,
    dataset_id: i64,
    dimension_index: usize,
    metric_index: Option<usize>,
    operation: String,
    search: String,
) -> Result<Vec<AggregateRow>, String> {
    let connection = connect(&app)?;
    let rows = load_query_rows(&connection, dataset_id, &search, None)?;
    let mut groups: HashMap<String, (f64, usize)> = HashMap::new();
    for row in rows {
        let key = row.get(dimension_index).cloned().unwrap_or_default();
        let metric = metric_index
            .and_then(|index| row.get(index))
            .and_then(|value| parse_number(value))
            .unwrap_or(0.0);
        let entry = groups.entry(key).or_insert((0.0, 0));
        entry.0 += metric;
        entry.1 += 1;
    }
    let mut result: Vec<AggregateRow> = groups
        .into_iter()
        .map(|(key, (sum, count))| {
            let value = match operation.as_str() {
                "sum" => sum,
                "avg" => {
                    if count > 0 {
                        sum / count as f64
                    } else {
                        0.0
                    }
                }
                _ => count as f64,
            };
            AggregateRow { key, value, count }
        })
        .collect();
    result.sort_by(|a, b| b.value.total_cmp(&a.value));
    result.truncate(100);
    Ok(result)
}

#[tauri::command]
fn export_dataset_csv(
    app: tauri::AppHandle,
    dataset_id: i64,
    search: String,
    path: String,
) -> Result<usize, String> {
    let connection = connect(&app)?;
    let columns = get_columns(&connection, dataset_id)?;
    let rows = load_query_rows(&connection, dataset_id, &search, None)?;
    let mut writer = csv::Writer::from_path(path).map_err(|error| error.to_string())?;
    writer
        .write_record(columns)
        .map_err(|error| error.to_string())?;
    for row in &rows {
        writer
            .write_record(row)
            .map_err(|error| error.to_string())?;
    }
    writer.flush().map_err(|error| error.to_string())?;
    Ok(rows.len())
}

#[tauri::command]
fn delete_dataset(app: tauri::AppHandle, dataset_id: i64) -> Result<(), String> {
    connect(&app)?
        .execute("DELETE FROM datasets WHERE id=?1", [dataset_id])
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            import_dataset,
            list_datasets,
            query_dataset,
            aggregate_dataset,
            export_dataset_csv,
            delete_dataset
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Yikon desktop client");
}
