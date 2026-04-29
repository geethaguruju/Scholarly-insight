const url = "https://export.arxiv.org/api/query?search_query=all:electron+AND+submittedDate:[202301010000+TO+202302010000]&max_results=2"
fetch(url, { headers: { "User-Agent": "test/1.0" } }).then(r => r.text()).then(console.log)
