package main

import (
	"io/ioutil"
	"net/http"
	"time"
)

var RESPONSE = []byte{}

func main() {
	go cacheLoop()

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write(RESPONSE)
	})
	err := http.ListenAndServe(":8999", nil)
	if err != nil {
		println(err.Error())
	}
}

func cacheLoop() {
	for {
		fetch()
		time.Sleep(30 * time.Second)
	}
}

func fetch() {
	client := &http.Client{}
	req, _ := http.NewRequest("GET", "https://layer.bicyclesharing.net/map/v1/mtl/map-inventory", nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64; rv:12.0) Gecko/20100101 Firefox/12.0")
	resp, err := client.Do(req)
	if err != nil {
		println(err.Error())
		return
	}
	defer resp.Body.Close()
	RESPONSE, _ = ioutil.ReadAll(resp.Body)
	println("Fetched")
}
