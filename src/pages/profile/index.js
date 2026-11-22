//jshint ignore:start

/**
 * Open the profile page. Works logged in or out.
 * @param {object} options
 * @param {object|null} [options.user] - logged in user, if any
 * @param {(user:object) => Promise<string>} [options.getAvatarSrc]
 * @param {() => Promise<object|null>} [options.onLogin] - resolves the new user
 * @param {() => Promise<boolean>} [options.onLogout]
 */
function Profile(options) {
	return import(/* webpackChunkName: "profile" */ "./profile").then((res) => {
		return res.default(options);
	});
}
export default Profile;
