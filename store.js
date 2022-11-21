/** Replaces localStorage in React Native */
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Store class to use localStorage or AsyncStorage */
export class Store {
	/** Type of storage we want to use: 'localStorage' or 'AsyncStorage' */
	type;

	/** Initialize storage with one of the supported options */
	constructor(options) {
		if(options && options.type) {
			if(options.type == "localStorage" || options.type == "AsyncStorage") {
				this.type = options.type;
			} else {
				console.log("Type not supported, defaulting to localStorage.");
				this.type = "localStorage";
			}
		} else {
			this.type = "localStorage";
		}
	}

	/** Function to set an item storage */
	async setItem(key, value) {
		switch (this.type) {
			/** Browser storage */
			case "localStorage":
				localStorage.setItem(key, value);
				return true;

			/** Async storage */
			case "AsyncStorage":
				await AsyncStorage.setItem(key, value);
				return true;
		}
	}

	/** Function to retrieve an item storage */
	async getItem(key) {

    let res;
		switch (this.type) {
			/** Browser storage */
			case "localStorage":
        res = localStorage.getItem(key);
				break;

			/** Async storage */
			case "AsyncStorage":
				res = await AsyncStorage.getItem(key);
				break;
		}
    return res;
	}

	/** Function to remove an item from the local storage */
	async removeItem(key) {
		switch (this.type) {
			/** Browser storage */
			case "localStorage":
				localStorage.removeItem(key);
				return true;

			/** Async storage */
			case "AsyncStorage":
				await AsyncStorage.removeItem(key);
				return true;
		}
	}
}
