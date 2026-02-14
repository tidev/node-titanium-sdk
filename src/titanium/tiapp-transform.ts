type TiappData = Record<string, any>;

export function tiappXmlToJson(doc: Document): TiappData {
	return {};
}

export function applyTiappJsonToXml(before: TiappData, after: TiappData, doc: Document): Document {
	// compute diff between before and after
	// update doc with diff
	return doc;
}
