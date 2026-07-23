// Cargo.toml setup:
// [lib]
// crate-type = ["cdylib", "rlib"]
// [dependencies]
// wasm-bindgen = "0.2"

use std::cmp::min;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn calculate_levenshtein_distance(str1: &str, str2: &str) -> usize {
    let len1 = str1.chars().count();
    let len2 = str2.chars().count();

    if len1 == 0 { return len2; }
    if len2 == 0 { return len1; }

    let mut matrix = vec![vec![0usize; len2 + 1]; len1 + 1];

    for i in 0..=len1 { matrix[i][0] = i; }
    for j in 0..=len2 { matrix[0][j] = j; }

    let char_array1: Vec<char> = str1.chars().collect();
    let char_array2: Vec<char> = str2.chars().collect();

    for i in 1..=len1 {
        for j in 1..=len2 {
            let cost = if char_array1[i - 1] == char_array2[j - 1] { 0 } else { 1 };
            matrix[i][j] = min(
                min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1),
                matrix[i - 1][j - 1] + cost,
            );
        }
    }

    matrix[len1][len2]
}

#[wasm_bindgen]
pub fn similarity_percentage(str1: &str, str2: &str) -> f64 {
    let distance = calculate_levenshtein_distance(str1, str2) as f64;
    let max_len = (str1.chars().count().max(str2.chars().count())) as f64;
    
    if max_len == 0.0 { return 100.0; }
    ((1.0 - (distance / max_len)) * 100.0)
}