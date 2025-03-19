export interface NotionResponse {
  readonly object: string;
  readonly id: string;
  readonly created_time: Date;
  readonly last_edited_time: Date;
  readonly created_by: TedBy;
  readonly last_edited_by: TedBy;
  readonly cover: null;
  readonly icon: Icon;
  readonly parent: Parent;
  readonly archived: boolean;
  readonly in_trash: boolean;
  readonly properties: Properties;
  readonly url: string;
  readonly public_url: null;
  readonly request_id: string;
}

interface TedBy {
  readonly object: string;
  readonly id: string;
}

interface Icon {
  readonly type: string;
  readonly emoji: string;
}

interface Parent {
  readonly type: string;
  readonly database_id: string;
}

interface Properties {
  readonly slug: Description;
  readonly icon: Description;
  readonly tags: Tags;
  readonly public: Public;
  readonly description: Description;
  readonly date: DateClass;
  readonly title: Title;
}

interface DateClass {
  readonly id: string;
  readonly type: string;
  readonly last_edited_time: string;
}

interface Description {
  readonly id: string;
  readonly type: string;
  readonly rich_text: RichText[];
}

interface RichText {
  readonly type: string;
  readonly text: Text;
  readonly annotations: Annotations;
  readonly plain_text: string;
  readonly href: null;
}

interface Annotations {
  readonly bold: boolean;
  readonly italic: boolean;
  readonly strikethrough: boolean;
  readonly underline: boolean;
  readonly code: boolean;
  readonly color: string;
}

interface Text {
  readonly content: string;
  readonly link: null;
}

interface Public {
  readonly id: string;
  readonly type: string;
  readonly checkbox: boolean;
}

interface Tags {
  readonly id: string;
  readonly type: string;
  readonly multi_select: MultiSelect[];
}

interface MultiSelect {
  readonly id: string;
  readonly name: string;
  readonly color: string;
}

interface Title {
  readonly id: string;
  readonly type: string;
  readonly title: RichText[];
}
