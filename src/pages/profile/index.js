//jshint ignore:start

/**
 * Open the profile page.
 * @param {object} options
 * @param {object} options.user - logged in user
 * @param {() => Promise<string>} [options.getAvatarSrc]
 * @param {() => Promise<boolean>} [options.onLogout]
 */
function Profile(options) {
	return import(/* webpackChunkName: "profile" */ "./profile").then((res) => {
		return res.default(options);
	});
}
export default Profile;
