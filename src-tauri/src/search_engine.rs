use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use tantivy::{
    collector::TopDocs,
    directory::MmapDirectory,
    doc,
    query::{BooleanQuery, Occur, QueryParser, TermQuery},
    schema::{Field, IndexRecordOption, Schema, SchemaBuilder, TextFieldIndexing, TextOptions, STORED, TEXT},
    Index, IndexReader, IndexWriter, Term,
};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchableItem {
    pub id: String,
    pub ocr_text: String,
    pub memo: String,
    pub tags: Vec<String>,
    pub location_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub group_title: Option<String>,
    pub image_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub score: f32,
    pub highlights: Vec<String>,
    pub matched_fields: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchQuery {
    pub query: String,
    pub fields: Option<Vec<String>>,
    pub date_from: Option<DateTime<Utc>>,
    pub date_to: Option<DateTime<Utc>>,
    pub tags: Option<Vec<String>>,
    pub limit: Option<usize>,
}

pub struct SearchEngine {
    index: Index,
    reader: IndexReader,
    writer: IndexWriter,
    schema: Schema,
    fields: HashMap<String, Field>,
}

impl SearchEngine {
    pub fn new(index_path: &Path) -> Result<Self> {
        let schema = Self::create_schema();
        let fields = Self::get_fields(&schema);
        
        let index = if index_path.exists() {
            Index::open_in_dir(index_path)?
        } else {
            Index::create_in_dir(index_path, schema.clone())?
        };

        let reader = index.reader()?;
        let writer = index.writer(50_000_000)?; // 50MB buffer

        Ok(SearchEngine {
            index,
            reader,
            writer,
            schema,
            fields,
        })
    }

    fn create_schema() -> Schema {
        let mut schema_builder = SchemaBuilder::new();
        
        // 各フィールドの定義
        let id_field = schema_builder.add_text_field("id", STORED);
        let ocr_text_field = schema_builder.add_text_field(
            "ocr_text",
            TextOptions::default()
                .set_indexing_options(
                    TextFieldIndexing::default()
                        .set_tokenizer("standard")
                        .set_index_option(IndexRecordOption::WithFreqsAndPositions),
                )
                .set_stored(),
        );
        let memo_field = schema_builder.add_text_field(
            "memo",
            TextOptions::default()
                .set_indexing_options(
                    TextFieldIndexing::default()
                        .set_tokenizer("standard")
                        .set_index_option(IndexRecordOption::WithFreqsAndPositions),
                )
                .set_stored(),
        );
        let tags_field = schema_builder.add_text_field(
            "tags",
            TextOptions::default()
                .set_indexing_options(
                    TextFieldIndexing::default()
                        .set_tokenizer("standard")
                        .set_index_option(IndexRecordOption::WithFreqsAndPositions),
                )
                .set_stored(),
        );
        let location_name_field = schema_builder.add_text_field(
            "location_name",
            TextOptions::default()
                .set_indexing_options(
                    TextFieldIndexing::default()
                        .set_tokenizer("standard")
                        .set_index_option(IndexRecordOption::WithFreqsAndPositions),
                )
                .set_stored(),
        );
        let created_at_field = schema_builder.add_date_field("created_at", STORED);
        let updated_at_field = schema_builder.add_date_field("updated_at", STORED);
        let group_title_field = schema_builder.add_text_field(
            "group_title",
            TextOptions::default()
                .set_indexing_options(
                    TextFieldIndexing::default()
                        .set_tokenizer("standard")
                        .set_index_option(IndexRecordOption::WithFreqsAndPositions),
                )
                .set_stored(),
        );
        let image_path_field = schema_builder.add_text_field("image_path", STORED);

        schema_builder.build()
    }

    fn get_fields(schema: &Schema) -> HashMap<String, Field> {
        let mut fields = HashMap::new();
        fields.insert("id".to_string(), schema.get_field("id").unwrap());
        fields.insert("ocr_text".to_string(), schema.get_field("ocr_text").unwrap());
        fields.insert("memo".to_string(), schema.get_field("memo").unwrap());
        fields.insert("tags".to_string(), schema.get_field("tags").unwrap());
        fields.insert("location_name".to_string(), schema.get_field("location_name").unwrap());
        fields.insert("created_at".to_string(), schema.get_field("created_at").unwrap());
        fields.insert("updated_at".to_string(), schema.get_field("updated_at").unwrap());
        fields.insert("group_title".to_string(), schema.get_field("group_title").unwrap());
        fields.insert("image_path".to_string(), schema.get_field("image_path").unwrap());
        fields
    }

    pub fn add_item(&mut self, item: SearchableItem) -> Result<()> {
        let doc = doc!(
            self.fields["id"] => item.id,
            self.fields["ocr_text"] => item.ocr_text,
            self.fields["memo"] => item.memo,
            self.fields["tags"] => item.tags.join(" "),
            self.fields["location_name"] => item.location_name.unwrap_or_default(),
            self.fields["created_at"] => tantivy::DateTime::from_utc(item.created_at),
            self.fields["updated_at"] => tantivy::DateTime::from_utc(item.updated_at),
            self.fields["group_title"] => item.group_title.unwrap_or_default(),
            self.fields["image_path"] => item.image_path.unwrap_or_default(),
        );

        self.writer.add_document(doc)?;
        self.writer.commit()?;
        Ok(())
    }

    pub fn update_item(&mut self, item: SearchableItem) -> Result<()> {
        // 既存のドキュメントを削除
        let term = Term::from_field_text(self.fields["id"], &item.id);
        self.writer.delete_term(term);
        
        // 新しいドキュメントを追加
        self.add_item(item)?;
        Ok(())
    }

    pub fn delete_item(&mut self, item_id: &str) -> Result<()> {
        let term = Term::from_field_text(self.fields["id"], item_id);
        self.writer.delete_term(term);
        self.writer.commit()?;
        Ok(())
    }

    pub fn search(&self, query: SearchQuery) -> Result<Vec<SearchResult>> {
        let searcher = self.reader.searcher();
        let query_parser = QueryParser::for_index(&self.index, vec![
            self.fields["ocr_text"],
            self.fields["memo"],
            self.fields["tags"],
            self.fields["location_name"],
            self.fields["group_title"],
        ]);

        // メインクエリの構築
        let main_query = if let Some(fields) = &query.fields {
            let mut field_queries = Vec::new();
            for field_name in fields {
                if let Some(&field) = self.fields.get(field_name) {
                    if let Ok(field_query) = query_parser.parse_query(&query.query) {
                        field_queries.push((Occur::Should, field_query));
                    }
                }
            }
            BooleanQuery::new(field_queries)
        } else {
            query_parser.parse_query(&query.query)?
        };

        // フィルター条件の構築
        let mut filters = Vec::new();

        // 日付フィルター
        if let Some(date_from) = query.date_from {
            let date_term = Term::from_field_date(
                self.fields["created_at"],
                tantivy::DateTime::from_utc(date_from),
            );
            filters.push((Occur::Must, Box::new(TermQuery::new(date_term, IndexRecordOption::Basic))));
        }

        if let Some(date_to) = query.date_to {
            let date_term = Term::from_field_date(
                self.fields["created_at"],
                tantivy::DateTime::from_utc(date_to),
            );
            filters.push((Occur::Must, Box::new(TermQuery::new(date_term, IndexRecordOption::Basic))));
        }

        // タグフィルター
        if let Some(tags) = query.tags {
            for tag in tags {
                let tag_term = Term::from_field_text(self.fields["tags"], &tag);
                filters.push((Occur::Must, Box::new(TermQuery::new(tag_term, IndexRecordOption::Basic))));
            }
        }

        // 最終的なクエリの構築
        let final_query = if filters.is_empty() {
            main_query
        } else {
            let mut all_conditions = vec![(Occur::Must, Box::new(main_query))];
            all_conditions.extend(filters);
            BooleanQuery::new(all_conditions)
        };

        // 検索実行
        let limit = query.limit.unwrap_or(20);
        let top_docs = searcher.search(&final_query, &TopDocs::with_limit(limit))?;

        let mut results = Vec::new();
        for (score, doc_address) in top_docs {
            let doc = searcher.doc(doc_address)?;
            
            let id = doc
                .get_first(self.fields["id"])
                .and_then(|v| v.as_text())
                .unwrap_or("")
                .to_string();

            let highlights = self.generate_highlights(&searcher, &doc, &query.query)?;
            let matched_fields = self.get_matched_fields(&doc, &query.query)?;

            results.push(SearchResult {
                id,
                score,
                highlights,
                matched_fields,
            });
        }

        Ok(results)
    }

    fn generate_highlights(&self, searcher: &tantivy::Searcher, doc: &tantivy::Document, query: &str) -> Result<Vec<String>> {
        let mut highlights = Vec::new();
        
        // 各フィールドからハイライトを生成
        let fields_to_highlight = ["ocr_text", "memo", "location_name", "group_title"];
        
        for field_name in fields_to_highlight {
            if let Some(&field) = self.fields.get(field_name) {
                if let Some(text_value) = doc.get_first(field).and_then(|v| v.as_text()) {
                    if text_value.to_lowercase().contains(&query.to_lowercase()) {
                        highlights.push(format!("{}: {}", field_name, text_value));
                    }
                }
            }
        }

        Ok(highlights)
    }

    fn get_matched_fields(&self, doc: &tantivy::Document, query: &str) -> Result<Vec<String>> {
        let mut matched_fields = Vec::new();
        let query_lower = query.to_lowercase();
        
        let fields_to_check = ["ocr_text", "memo", "tags", "location_name", "group_title"];
        
        for field_name in fields_to_check {
            if let Some(&field) = self.fields.get(field_name) {
                if let Some(text_value) = doc.get_first(field).and_then(|v| v.as_text()) {
                    if text_value.to_lowercase().contains(&query_lower) {
                        matched_fields.push(field_name.to_string());
                    }
                }
            }
        }

        Ok(matched_fields)
    }

    pub fn clear_index(&mut self) -> Result<()> {
        self.writer.delete_all_documents()?;
        self.writer.commit()?;
        Ok(())
    }

    pub fn get_stats(&self) -> Result<HashMap<String, usize>> {
        let searcher = self.reader.searcher();
        let stats = searcher.segment_readers().iter().map(|reader| {
            let num_docs = reader.num_docs();
            (format!("segment_{}", reader.segment_id().uuid_string()), num_docs)
        }).collect();
        Ok(stats)
    }
} 