from pydantic import BaseModel, Field
from app.schemas.word import WordBase


class IlyaFrankExcerpt(BaseModel):
    index: int = Field(..., description="1-based index of the dual-pass excerpt")
    adapted_text: str = Field(
        ...,
        description="Adapted segment (Ai) with inline parenthetical glosses placed before punctuation",
    )
    raw_text: str = Field(
        ...,
        description="Unadapted raw segment (Ui) matching authentic source text with zero annotations",
    )
    vocabulary_extracted: list[WordBase] = Field(
        default_factory=list,
        description="List of extracted vocabulary items with lemmas, translations, and morphological indicators",
    )


class IlyaFrankResponse(BaseModel):
    excerpts: list[IlyaFrankExcerpt] = Field(
        default_factory=list,
        description="Sequential list of paired dual-pass excerpts",
    )


class IlyaFrankGenerateRequest(BaseModel):
    text: str | None = Field(default=None, description="Input authentic text to adapt")
    selected_words: list[str] = Field(default_factory=list, description="Target words/collocations to gloss")
    source_lang: str | None = Field(default=None, max_length=10)
    target_lang: str | None = Field(default=None, max_length=10)
